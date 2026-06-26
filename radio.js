// ── SIGNAL RADIO ─────────────────────────────────────────────────────────────
const RPROXY='https://signal-hazel-mu.vercel.app';
const RMIRRORS=['https://de1.api.radio-browser.info','https://fr1.api.radio-browser.info','https://nl1.api.radio-browser.info'];
let rActiveMirror=RMIRRORS[0];
let rStations=[],rIdx=0,rPlaying=false,rMoonCoords=null,rHistory=[];
let rInitPromise=null;
let rScanLocked=false;
let rNowStamp={name:'',country:'',coords:''};

async function rApiFetch(path){
  for(const m of RMIRRORS){try{const r=await fetch(`${m}${path}`,{headers:{'User-Agent':'SIGNAL-oracle/1.0'}});if(r.ok){rActiveMirror=m;return r.json();}}catch(e){continue;}}
  throw new Error('mirrors failed');
}
async function rFetchByCountry(cc,limit=50){return rApiFetch(`/json/stations/search?countrycode=${cc}&limit=${limit}&order=votes&reverse=true&hidebroken=true`);}

const NEIGHBORS={'IS':['GB','IE','NO'],'IE':['GB'],'NO':['SE','FI','DK'],'FI':['SE','NO','EE'],'EE':['LV','FI'],'LV':['EE','LT'],'LT':['LV','PL','BY'],'BY':['PL','UA','RU'],'UA':['RU','PL','RO'],'MD':['RO','UA'],'RO':['UA','BG','HU'],'BG':['RO','GR','RS'],'GR':['BG','MK','AL'],'AL':['GR','RS'],'MK':['GR','AL','RS'],'RS':['HR','BA','HU'],'BA':['HR','RS'],'HR':['SI','HU','BA'],'SI':['AT','IT','HR'],'AT':['DE','CH','IT'],'CH':['DE','FR','IT'],'LU':['BE','DE','FR'],'BE':['FR','NL','DE'],'NL':['BE','DE'],'DK':['DE','SE'],'SE':['NO','FI','DK'],'PT':['ES'],'ES':['FR','PT'],'IT':['FR','AT','SI'],'MT':['IT'],'CY':['GR'],'TR':['GR','BG','GE'],'GE':['TR','AM','AZ'],'AM':['GE','AZ','TR'],'AZ':['GE','AM','IR'],'IR':['TR','IQ','PK'],'IQ':['TR','IR','SY'],'SY':['TR','IQ','LB'],'LB':['SY','IL'],'IL':['LB','JO'],'JO':['SY','IQ','SA'],'SA':['JO','IQ','YE'],'YE':['SA','OM'],'OM':['SA','AE'],'AE':['SA','OM'],'QA':['SA','AE'],'KW':['SA','IQ'],'BH':['SA'],'PK':['IR','IN','AF'],'AF':['PK','IR','TJ'],'IN':['PK','CN','NP','BD'],'NP':['IN','CN'],'BD':['IN','MM'],'LK':['IN'],'MM':['BD','TH','CN'],'TH':['MM','LA','KH'],'LA':['TH','VN','CN'],'VN':['LA','KH','CN'],'KH':['TH','VN'],'MY':['TH','ID','BN'],'SG':['MY'],'ID':['MY','PG'],'PH':['ID'],'TW':['CN'],'JP':['KR'],'KR':['JP','CN'],'MN':['CN','RU'],'KZ':['RU','CN'],'UZ':['KZ','AF'],'TM':['KZ','IR'],'TJ':['UZ','AF'],'KG':['KZ','UZ'],'CN':['RU','MN','KZ','IN'],'EG':['LY','SD','IL'],'LY':['EG','TN','DZ'],'TN':['LY','DZ'],'DZ':['TN','LY','MA'],'MA':['DZ','ES'],'MR':['MA','SN','ML'],'SN':['MR','GM','GN'],'ML':['MR','DZ','NE'],'NE':['ML','DZ','NG'],'NG':['NE','BJ','CM'],'CM':['NG','CF','GA'],'GH':['CI','TG','BF'],'CI':['GH','GN','ML'],'ET':['ER','SD','SO','KE'],'KE':['ET','SO','TZ','UG'],'TZ':['KE','UG','MZ'],'ZA':['MZ','ZW','BW','NA'],'MX':['US','GT','BZ'],'GT':['MX','BZ','HN'],'CO':['VE','BR','PE'],'VE':['CO','BR','GY'],'BR':['CO','VE','PE','BO','AR'],'AR':['BR','CL','BO','PY'],'CL':['AR','PE'],'PE':['CO','BR','CL','BO'],'AU':['NZ','PG'],'NZ':['AU']};

async function rReverseGeocode(lat,lon){
  const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{headers:{'User-Agent':'SIGNAL-oracle/1.0','Accept-Language':'en'}});
  if(!r.ok)throw new Error('nominatim '+r.status);
  const d=await r.json();
  return{country:d.address?.country||null,countryCode:d.address?.country_code?.toUpperCase()||null,isOcean:!d.address?.country,ocean:d.name||d.display_name||'open ocean'};
}

function rRoughMoon(){
  // Use UTC milliseconds explicitly
  const now=Date.now();
  const jd=now/86400000+2440587.5;
  const D=jd-2451545.0; // days since J2000.0
  const r=Math.PI/180;
  // Full Meeus Ch.47 terms
  const L=(218.3164477+13.17639648*D)%360;
  const M=(134.9633964+13.06499295*D)%360;
  const F=(93.2720950 +13.22935024*D)%360;
  const D2=(297.8501921+12.19074912*D)%360;
  const Ms=(357.5291092+ 0.98560028*D)%360;
  const mLon=(L
    +6.288774*Math.sin(r*M)
    +1.274027*Math.sin(r*(2*D2-M))
    +0.658314*Math.sin(r*2*D2)
    +0.213618*Math.sin(r*2*M)
    -0.185116*Math.sin(r*Ms)
    -0.114332*Math.sin(r*2*F)
    +0.058793*Math.sin(r*(2*D2-2*M))
    +0.057066*Math.sin(r*(2*D2-Ms-M))
    +0.053322*Math.sin(r*(2*D2+M))
    +0.045758*Math.sin(r*(2*D2-Ms))
    -0.040923*Math.sin(r*(Ms-M))
    -0.034720*Math.sin(r*D2)+360)%360;
  const mLat=5.128122*Math.sin(r*F)
    +0.280602*Math.sin(r*(M+F))
    +0.277693*Math.sin(r*(M-F))
    +0.173237*Math.sin(r*(2*D2-F))
    +0.055413*Math.sin(r*(2*D2+F-M))
    +0.046271*Math.sin(r*(2*D2-F-M));
  const eps=(23.4393-0.0000004*D)*r;
  const lonR=mLon*r, latR=mLat*r;
  // Ecliptic → equatorial
  const ra=(Math.atan2(Math.sin(lonR)*Math.cos(eps)-Math.tan(latR)*Math.sin(eps),Math.cos(lonR))*180/Math.PI+360)%360;
  const dec=Math.asin(Math.sin(latR)*Math.cos(eps)+Math.cos(latR)*Math.sin(eps)*Math.sin(lonR))*180/Math.PI;
  // Greenwich Mean Sidereal Time (degrees) — IAU formula
  // T = Julian centuries from J2000.0
  const T=D/36525;
  const gmst=((280.46061837+360.98564736629*D+0.000387933*T*T-T*T*T/38710000)%360+360)%360;
  // Sublunar longitude = RA - GMST
  let geoLon=(ra-gmst+360)%360;
  if(geoLon>180) geoLon-=360;
  return{lat:dec,lon:geoLon};
}

async function rGetMoon(){
  return{...rRoughMoon(),source:'approx'};
}

async function rInit(){
  rDisableControls();
  rSetStatus('locating moon…');
  rSetMoonText('locating moon…',true);
  rMoonCoords=await rGetMoon();
  window.rMoonCoords=rMoonCoords;
  const fetchedAt=new Date();
  document.getElementById('footer-coords').innerHTML=`moon: ${rFmtCoords(rMoonCoords.lat,rMoonCoords.lon)} (${rMoonCoords.source})`;
  const coordEl=document.getElementById('rmoon-coords');
  const tsEl=document.getElementById('rmoon-timestamp');
  if(coordEl)coordEl.innerHTML=rFmtCoords(rMoonCoords.lat,rMoonCoords.lon);
  const stampEl=document.getElementById('moon-stamp-coords');
  if(stampEl)stampEl.innerHTML=`528.0 Hz\n${rFmtCoords(rMoonCoords.lat,rMoonCoords.lon)}`;
  if(tsEl)tsEl.innerHTML='as of '+fetchedAt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
  const moonUpEl=document.getElementById('moon-update-time');
  if(moonUpEl)moonUpEl.innerHTML='updated '+new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
  rSetStatus('finding country…'); 
  let geo;
  try{geo=await rReverseGeocode(rMoonCoords.lat,rMoonCoords.lon);}
  catch(e){await rGlobalFallback();return;}
  if(geo.isOcean){
    const oceanName=rNameOcean(rMoonCoords.lat,rMoonCoords.lon);
    rLastZone=oceanName;
    rSetMoonText(''+oceanName); /* moon over  */
    if(coordEl)coordEl.innerHTML=rFmtCoords(rMoonCoords.lat,rMoonCoords.lon);
    await rOceanFallback(rMoonCoords.lat,rMoonCoords.lon);return;
  }
  rLastZone=geo.countryCode||null;
  if(coordEl)coordEl.innerHTML=rFmtCoords(rMoonCoords.lat,rMoonCoords.lon);
  rSetMoonText(''+geo.country); /* moon over  */
  rSetStatus('fetching stations…');
  try{
    let list=await rFetchByCountry(geo.countryCode,50);
    if(list.length<10){for(const nc of(NEIGHBORS[geo.countryCode]||[]).slice(0,3)){const extra=await rFetchByCountry(nc,20);list=[...list,...extra];if(list.length>=20)break;}}
    if(!list.length){await rGlobalFallback();return;}
    rNowStamp.country=geo.country||geo.countryCode||'';
    rNowStamp.coords=rFmtCoords(rMoonCoords.lat,rMoonCoords.lon);
    rLoad(list);
  }catch(e){await rGlobalFallback();}
}

function rEnsureRadioInit(){
  if(rStations.length) return Promise.resolve(rStations);
  if(rInitPromise) return rInitPromise;
  rInitPromise = rInit().finally(()=>{ rInitPromise=null; });
  return rInitPromise;
}

// Format lat/lon with cardinal directions
function rFmtCoords(lat,lon){
  const ns=lat>=0?'<i>N</i>':'<i>S</i>', ew=lon>=0?'<i>E</i>':'<i>W</i>';
  return `${Math.abs(lat).toFixed(2)}°${ns},${Math.abs(lon).toFixed(2)}°${ew}`;
}

// Track last evaluated zone so moonRefresh can detect when it changes
let rLastZone=null;

function rNameOcean(lat,lon){
  if(lat>70)return'Arctic Ocean';
  if(lat<-55)return'Southern Ocean';
  if(lon>=20&&lon<=147&&lat>-60&&lat<30)return'Indian Ocean';
  if(lon>100||lon<-70)return lat>0?'North Pacific Ocean':'South Pacific Ocean';
  return lat>0?'North Atlantic Ocean':'South Atlantic Ocean';
}

// Ocean → nearest countries with good radio coverage, in priority order
const OCEAN_COUNTRIES={
  'North Atlantic Ocean': ['CV','SN','MA','PT','US','CA','IE','ES','GB','NO','IS'],
  'South Atlantic Ocean': ['SH','CV','GW','ST','NG','AO','GH','BR','ZA','AR'],
  'North Pacific Ocean':  ['GU','MP','FM','PW','MH','PH','TW','JP','KR','MX','US','CA'],
  'South Pacific Ocean':  ['PF','WS','TO','CK','FJ','VU','NC','SB','PG','NZ','CL','AU'],
  'Indian Ocean':         ['MV','SC','RE','MU','MG','MZ','TZ','LK','IN','ID','AU','ZA'],
  'Southern Ocean':       ['CL','ZA','AR','AU'],
  'Arctic Ocean':         ['IS','NO','FI','CA','RU'],
};

const CC_NAMES={'AU':'Australia','NZ':'New Zealand','CL':'Chile','PE':'Peru','PG':'Papua New Guinea','JP':'Japan','KR':'South Korea','US':'United States','MX':'Mexico','CA':'Canada','PH':'Philippines','TW':'Taiwan','PT':'Portugal','ES':'Spain','IE':'Ireland','GB':'United Kingdom','IS':'Iceland','NO':'Norway','MA':'Morocco','BR':'Brazil','ZA':'South Africa','AR':'Argentina','NG':'Nigeria','AO':'Angola','GH':'Ghana','SN':'Senegal','IN':'India','MZ':'Mozambique','TZ':'Tanzania','ID':'Indonesia','MG':'Madagascar','RU':'Russia','FI':'Finland','PF':'French Polynesia','WS':'Samoa','TO':'Tonga','CK':'Cook Islands','FJ':'Fiji','VU':'Vanuatu','NC':'New Caledonia','SB':'Solomon Islands','MV':'Maldives','SC':'Seychelles','RE':'Réunion','MU':'Mauritius','GU':'Guam','FM':'Micronesia','MH':'Marshall Islands','CV':'Cape Verde','SH':'Saint Helena','ST':'São Tomé','GW':'Guinea-Bissau','MP':'Northern Mariana Islands','PW':'Palau','LK':'Sri Lanka'};

// Approximate center coords per country code, used to pick nearest ocean fallback
const CC_COORDS={'AU':[-25,134],'NZ':[-41,174],'CL':[-35,-71],'PE':[-10,-76],'PG':[-6,147],'JP':[36,138],'KR':[37,128],'US':[38,-97],'MX':[24,-102],'CA':[60,-96],'PH':[13,122],'TW':[24,121],'PT':[39,-8],'ES':[40,-4],'IE':[53,-8],'GB':[54,-2],'IS':[65,-18],'NO':[61,8],'MA':[32,-5],'BR':[-10,-55],'ZA':[-30,25],'AR':[-34,-64],'NG':[10,8],'AO':[-12,18],'GH':[8,-1],'SN':[14,-14],'IN':[21,78],'MZ':[-18,35],'TZ':[-6,35],'ID':[-5,120],'MG':[-20,47],'RU':[62,105],'FI':[64,26],'PF':[-15,-140],'WS':[-14,-172],'TO':[-21,-175],'CK':[-21,-159],'FJ':[-18,178],'VU':[-16,167],'NC':[-21,165],'SB':[-9,160],'MV':[4,73],'SC':[-5,55],'RE':[-21,55],'MU':[-20,57],'GU':[13,145],'FM':[7,152],'MH':[9,168],'CV':[16,-24],'SH':[-16,-6],'ST':[1,7],'GW':[12,-15],'MP':[15,146],'PW':[7,134],'LK':[8,81]};
function rNearestCandidates(lat,lon,list){
  // Wrap longitude difference to [-180,180] for correct cross-dateline distance
  return list.slice().sort((a,b)=>{
    const ca=CC_COORDS[a]||[0,0],cb=CC_COORDS[b]||[0,0];
    const wrapDiff=(x,y)=>{let d=(x-y+540)%360-180;return d;};
    const da=Math.hypot(lat-ca[0],wrapDiff(lon,ca[1]));
    const db=Math.hypot(lat-cb[0],wrapDiff(lon,cb[1]));
    return da-db;
  });
}

async function rOceanFallback(lat,lon){
  const oceanName=rNameOcean(lat,lon);
  rSetMoonText(''+oceanName);
  // Pick the nearest countries from ALL known CC_COORDS rather than ocean buckets
  const allCodes=Object.keys(CC_COORDS);
  const nearest=rNearestCandidates(lat,lon,allCodes).slice(0,12);
  for(const cc of nearest){
    try{
      const list=await rFetchByCountry(cc,50);
      if(list&&list.length){
        const name=CC_NAMES[cc]||cc;
        rSetMoonText(''+oceanName+' · '+name);
        rNowStamp.country=oceanName+' · '+name;
        rNowStamp.coords=rFmtCoords(rMoonCoords?.lat||0,rMoonCoords?.lon||0);
        rLoad(list);return;
      }
    }catch(e){continue;}
  }
  // Last resort
  try{const list=await rApiFetch('/json/stations/topvote/50');if(list&&list.length){rLoad(list);return;}}catch(e){}
  rSetStatus('signal lost — tap refresh to retry');
  document.getElementById('rrefresh').disabled=false;
}

async function rGlobalFallback(){
  rSetMoonText('signal lost · trying global');
  document.getElementById('footer-station').textContent='station: global';
  rNowStamp.country='global';
  rNowStamp.coords='';
  try{const list=await rApiFetch('/json/stations/topvote/50');rLoad(list);}
  catch(e){rSetStatus('signal lost');}
}



function rLoad(list){
  // Filter out HTTP-only streams and stations with no stream URL
  // Also filter out religious/prayer stations that dominate vote counts globally
  const BLOCKED_TAGS = ['religious','islamic','quran','christian','gospel','prayer','church','sermon','bible','spiritual'];
  const BLOCKED_NAMES = ['abdulbasit','abdulsamad','quran','quraan','recitation','holy quran','al quran'];
  list = list.filter(s => {
    const url = s.url_resolved || s.url || '';
    if(!url.startsWith('https://') || url.length <= 10) return false;
    const tags = (s.tags || '').toLowerCase();
    const name = (s.name || '').toLowerCase();
    if(BLOCKED_TAGS.some(t => tags.includes(t))) return false;
    if(BLOCKED_NAMES.some(n => name.includes(n))) return false;
    return true;
  });
  if(!list.length){ rSetStatus('no secure stations found — retrying…'); rGlobalFallback(); return; }
  // Shuffle on load so we don't always start at A
  for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  rStations=list;rIdx=0;rHistory=[0];
  rBuildDropdown(list);rRenderStation(list[0]);rEnableControls();
  rSetStatus('');
  document.getElementById('rrefresh').disabled=false;
}


function rSetMoonText(txt,spinner=false){
  document.getElementById('rmoon-text').innerHTML=spinner?`<span class="rspinsm"></span>${txt}`:`${txt}`;
}

function rWriteStamp(name,country,coords){
  rNowStamp={name,country,coords};
  const el=document.getElementById('rnow-stamp');
  const sn=document.getElementById('rstamp-name');
  const sc=document.getElementById('rstamp-country');
  const sk=document.getElementById('rstamp-coords');
  if(sn)sn.innerHTML=name;
  if(sc)sc.innerHTML=country;
  if(sk){
    sk.innerHTML=coords;
    // hide coords and its preceding separator when there are no coords
    const coordSep=sk.previousElementSibling;
    const hasCoords=!!coords;
    sk.style.display=hasCoords?'':'none';
    if(coordSep&&coordSep.classList.contains('bb-stamp-sep'))coordSep.style.display=hasCoords?'':'none';
  }
  // mirror coords into title bar
  const hc=document.getElementById('bb-header-coords');
  const hs=document.getElementById('bb-header-coord-sep');
  if(hc){hc.innerHTML=coords||'';}
  if(hs){hs.style.display=coords?'':'none';}
  if(el)el.style.display='flex';
}

let _rLockedMsgTimer=null;
function rLockScan(){
  rScanLocked=true;
  const back=document.getElementById('rbackbtn');
  const skip=document.getElementById('rskipbtn');
  if(back){back.classList.add('scan-locked');back.disabled=true;}
  if(skip){skip.classList.add('scan-locked');skip.disabled=true;}
  const rlBtn=document.getElementById('rlocation-refresh');
  if(rlBtn){
    rlBtn.disabled=false;
    rlBtn.style.opacity='1';
    rlBtn.style.cursor='pointer';
    const img=rlBtn.querySelector('img');
    // invert(1) = white, then sepia+saturate+hue-rotate to shift to --signal red
    if(img) img.style.filter='invert(1) sepia(1) saturate(6) hue-rotate(310deg)';
  }
}

function rShowLockedHint(){
  const msg=document.getElementById('rscan-locked-msg');
  if(!msg)return;
  msg.style.display='inline';
  clearTimeout(_rLockedMsgTimer);
  _rLockedMsgTimer=setTimeout(()=>{msg.style.display='none';},2800);
}

function cleanStationName(raw){
  if(!raw) return '—';
  let s = raw
    .replace(/\[.*?\]/g, '')           // remove [mp3] [aac] [320] etc
    .replace(/\(.*?\)/g, '')           // remove (128kbps) (HD) etc
    .replace(/https?:\/\/\S+/g, '')    // remove URLs
    .replace(/(mp3|aac|flac|ogg|hls|128|256|320|kbps|khz|mhz|fm|am|hd|radio|stream|live)/gi, '')
    .replace(/[-_|•·:]+/g, ' ')        // normalize separators
    .replace(/\s{2,}/g, ' ')           // collapse spaces
    .trim();
  // Title case
  s = s.replace(/\w/g, c => c.toUpperCase());
  s = s || raw.trim();
  // Cap length so long names never push the player layout or overlap content above
  const MAX = 40;
  if(s.length > MAX) s = s.slice(0, MAX).trimEnd() + '…';
  return s;
}

function rRenderStation(s){
  const clean=cleanStationName(s.name);
  const rstel=document.getElementById('rstation');
  if(rstel)rstel.textContent=clean;
  document.getElementById('footer-station').textContent=`station: ${clean} (${rIdx+1}/${rStations.length})`;
  const np=document.getElementById('rnowplaying');
  const name=document.getElementById('rnowname');
  const count=document.getElementById('rnowcount');
  if(np)np.style.display='flex';
  if(name)name.textContent=clean;
  if(count)count.textContent=`${rIdx+1} / ${rStations.length}`;
  // Update stamp name; country+coords stay frozen from load time
  if(rNowStamp.country){
    rWriteStamp(clean,rNowStamp.country,rNowStamp.coords);
  }
}

function rBuildDropdown(list){ /* removed */ }
function rPickDropdown(idx){ /* removed */ }

function rSetStatus(msg){
  // Only show informational messages when not in an active audio state.
  // Active-state UI is exclusively managed by _rSyncUI().
  if(rState==='playing'||rState==='loading'||rState==='buffering') return;
  const el=document.getElementById('rstatus');
  if(el) el.textContent=msg;
}

function rBack(){
  bbExpand();
  if(rScanLocked){rShowLockedHint();return;}
  if(rHistory.length>1){rHistory.pop();rIdx=rHistory[rHistory.length-1];}
  else if(rHistory.length===1){rIdx=rHistory[0];}
  else{rIdx=(rIdx-1+rStations.length)%rStations.length;}
  const wasPlaying=rPlaying;rStopAudio();rRenderStation(rStations[rIdx]);if(wasPlaying)rStartAudio();
}

function rEnableControls(){['rplaybtn','rbackbtn','rskipbtn'].forEach(id=>document.getElementById(id).disabled=false);}
function rDisableControls(){['rplaybtn','rbackbtn','rskipbtn'].forEach(id=>document.getElementById(id).disabled=true);document.getElementById('rrefresh').disabled=true;}

function rRefresh(){
  window.location.reload();
}

function rRadioRefresh(){
  bbExpand();
  if(!rScanLocked) return;
  rScanLocked=false;
  // Remove lock styling and re-enable skip buttons immediately
  const back=document.getElementById('rbackbtn');
  const skip=document.getElementById('rskipbtn');
  if(back){back.classList.remove('scan-locked');back.disabled=false;}
  if(skip){skip.classList.remove('scan-locked');skip.disabled=false;}
  const rlBtn=document.getElementById('rlocation-refresh');
  if(rlBtn){
    rlBtn.disabled=true;
    rlBtn.style.opacity='.3';
    rlBtn.style.cursor='default';
    const img=rlBtn.querySelector('img');
    if(img) img.style.filter='invert(1)'; // back to white/dim
  }
  // Stop whatever is currently playing so we cleanly switch to new geo-located stations
  const wasPlaying=rPlaying;
  rStopAudio();
  rStations=[];
  rInitPromise=null;
  // After new stations load, auto-start if audio was active
  rEnsureRadioInit().then(()=>{
    if(wasPlaying && rStations.length) rStartAudio();
  }).catch(()=>{});
}

const aud=document.getElementById('raud');

// ── Radio state machine ───────────────────────────────────────────────────────
// States: 'idle' | 'loading' | 'buffering' | 'playing' | 'stopped'
// Single source of truth — UI is always driven from here, never from audio events directly.
let rState = 'idle'; // current state
let rLoadToken = 0;  // increments on every new load attempt; lets stale callbacks self-cancel
let rBufferTimer = null;   // fires if buffering takes too long → auto-skip
let rStalledTimer = null;  // fires if audio stalls mid-play → auto-skip
const BUFFER_TIMEOUT_MS = 9000;  // give a station 9s to start playing before skipping
const STALL_TIMEOUT_MS  = 6000;  // skip after 6s of stalling mid-stream
const MAX_AUTO_SKIPS    = 4;     // don't auto-skip more than 4 times in a row without user action
let rAutoSkipCount = 0;

function _rSetState(next) {
  rState = next;
  _rSyncUI();
}

function _rSyncUI() {
  const pb    = document.getElementById('rplaybtn');
  const stEl  = document.getElementById('rstatus');
  if (!pb || !stEl) return;

  // Clear all timers first — only re-arm if still in a waiting state
  if (rState !== 'loading' && rState !== 'buffering') _rClearBufferTimer();
  if (rState !== 'playing') { _rClearStalledTimer(); }

  switch (rState) {
    case 'idle':
      pb.textContent = '\uF169';
      stEl.textContent = '';
      break;
    case 'loading':
      pb.textContent = '\uF166';
      stEl.innerHTML = '<span class="rspinsm"></span>connecting…';
      break;
    case 'buffering':
      pb.textContent = '\uF166';
      stEl.innerHTML = '<span class="rspinsm"></span>buffering…';
      break;
    case 'playing':
      pb.textContent = '\uF166';
      stEl.textContent = 'playing';
      rAutoSkipCount = 0; // successful play resets the skip counter
      break;
    case 'stopped':
      pb.textContent = '\uF169';
      stEl.textContent = 'stopped';
      break;
  }
  // keep rPlaying in sync so legacy callers (rBack, rSkip, rShuffle) still work
  rPlaying = (rState === 'loading' || rState === 'buffering' || rState === 'playing');
}

function _rClearBufferTimer() {
  if (rBufferTimer) { clearTimeout(rBufferTimer); rBufferTimer = null; }
}
function _rClearStalledTimer() {
  if (rStalledTimer) { clearTimeout(rStalledTimer); rStalledTimer = null; }
}
function _rArmBufferTimer(token) {
  _rClearBufferTimer();
  rBufferTimer = setTimeout(() => {
    if (rLoadToken !== token) return; // stale
    console.log('[radio] buffer timeout → auto-skip');
    _rAutoSkip();
  }, BUFFER_TIMEOUT_MS);
}
function _rAutoSkip() {
  if (rAutoSkipCount >= MAX_AUTO_SKIPS) {
    // Too many consecutive failures — give up and surface an error
    _rHardStop();
    const stEl = document.getElementById('rstatus');
    if (stEl) stEl.textContent = 'signal lost — tap skip or refresh';
    rAutoSkipCount = 0;
    return;
  }
  rAutoSkipCount++;
  rIdx = (rIdx + 1) % rStations.length;
  rHistory.push(rIdx);
  if (rHistory.length > 50) rHistory.shift();
  rRenderStation(rStations[rIdx]);
  rStartAudio();
}

// ── Native audio event listeners ──────────────────────────────────────────────
// These inform the state machine; they never directly mutate UI.
aud.addEventListener('playing', () => {
  // Clear connection timeout — we have audio
  if (rState === 'loading' || rState === 'buffering') {
    _rClearBufferTimer();
    _rClearStalledTimer();
    _rSetState('playing');
    // Do NOT arm a stall timer here. Browsers fire waiting/stalled
    // routinely during normal streaming (rebuffering between chunks).
    // We rely solely on the hard 'error' event to detect dead streams.
  }
});

aud.addEventListener('waiting', () => {
  // Only show buffering during the initial connection window.
  // Once playing, ignore — browsers buffer mid-stream constantly.
  if (rState === 'loading') {
    _rSetState('buffering');
    // Keep the buffer timeout ticking (already armed from rStartAudio)
  }
});

aud.addEventListener('stalled', () => {
  // Fires constantly on live streams — only act during initial load.
  if (rState === 'loading') {
    _rSetState('buffering');
  }
});

aud.addEventListener('canplay', () => {
  // Stream declared ready; clear buffer timeout (playing event will follow)
  _rClearBufferTimer();
});

aud.addEventListener('error', () => {
  // Hard error — stream is dead. Skip regardless of state.
  if (rState === 'loading' || rState === 'buffering' || rState === 'playing') {
    console.log('[radio] audio error on station', rIdx, '— auto-skip');
    _rClearBufferTimer();
    _rClearStalledTimer();
    _rAutoSkip();
  }
});

aud.addEventListener('pause', () => {
  // Only update UI if this wasn't triggered by our own stop call
  // (rState will already be 'stopped' in that case)
  if (rState === 'playing' || rState === 'buffering') {
    _rSetState('stopped');
  }
});

document.getElementById('rvol').addEventListener('input', e => {
  aud.volume = parseFloat(e.target.value);
});

// ── Core controls ─────────────────────────────────────────────────────────────
function _rHardStop() {
  _rClearBufferTimer();
  _rClearStalledTimer();
  rLoadToken++; // invalidate any in-flight callbacks
  aud.pause();
  aud.src = '';
  try { aud.load(); } catch(e) {}
  _rSetState('stopped');
}

function rStartAudio() {
  if (!rStations.length) return;
  _rClearBufferTimer();
  _rClearStalledTimer();
  const token = ++rLoadToken;
  const s = rStations[rIdx];
  const src = s.url_resolved || s.url || '';
  if (!src) { _rAutoSkip(); return; }

  // Ping the radio-browser click counter (fire-and-forget)
  fetch(`${rActiveMirror}/json/url/${s.stationuuid}`).catch(() => {});

  aud.pause();
  aud.src = src;
  aud.volume = parseFloat(document.getElementById('rvol').value);
  aud.load();

  _rSetState('loading');
  _rArmBufferTimer(token);

  aud.play().catch(err => {
    if (rLoadToken !== token) return; // superseded
    // Autoplay blocked — surface a tap-to-play prompt instead of auto-skipping
    if (err.name === 'NotAllowedError') {
      _rClearBufferTimer();
      _rClearStalledTimer();
      _rSetState('stopped');
      const stEl = document.getElementById('rstatus');
      if (stEl) stEl.textContent = 'tap play to start';
    } else {
      console.log('[radio] play() rejected:', err.message, '— auto-skip');
      _rAutoSkip();
    }
  });
}

function rStopAudio() {
  rAutoSkipCount = 0; // manual stop resets auto-skip count
  _rHardStop();
}

let _bbAutoTimer = null;
function bbClearAutoCollapse() { if (_bbAutoTimer) { clearTimeout(_bbAutoTimer); _bbAutoTimer = null; } }
function bbScheduleAutoCollapse() { bbClearAutoCollapse(); _bbAutoTimer = setTimeout(() => { const bar = document.getElementById('subluna-bottombar'); if (bar && !bar.classList.contains('collapsed')) { bbToggleCollapse(); } }, 4000); }
function bbExpand() {
  const bar = document.getElementById('subluna-bottombar');
  const btn = document.getElementById('bb-collapse-btn');
  if (!bar || !bar.classList.contains('collapsed')) { bbScheduleAutoCollapse(); return; }
  bar.classList.remove('collapsed');
  if (btn) btn.setAttribute('aria-label', 'collapse player');
  bbScheduleAutoCollapse();
}
function bbToggleCollapse() {
  const bar = document.getElementById('subluna-bottombar');
  const btn = document.getElementById('bb-collapse-btn');
  if (!bar) return;
  const collapsed = bar.classList.toggle('collapsed'); if (!collapsed) { bbScheduleAutoCollapse(); } else { bbClearAutoCollapse(); }
  btn.setAttribute('aria-label', collapsed ? 'expand player' : 'collapse player');
  localStorage.removeItem('bb_collapsed');
}
(function bbRestoreCollapse() {
  const bar = document.getElementById('subluna-bottombar');
  const btn = document.getElementById('bb-collapse-btn');
  if (localStorage.getItem('bb_collapsed') === '1') {
    if (bar) bar.classList.add('collapsed');
    if (btn) btn.setAttribute('aria-label', 'expand player');
  } else {
    setTimeout(() => {
      if (bar && !bar.classList.contains('collapsed')) { bbScheduleAutoCollapse(); }
    }, 500);
  }
})();

function rTogglePlay() {
  bbExpand();
  if (rState === 'playing' || rState === 'loading' || rState === 'buffering') {
    rStopAudio();
  } else {
    rStartAudio();
  }
}

function rSkip() {
  bbExpand();
  if(rScanLocked){rShowLockedHint();return;}
  const wasActive = (rState === 'playing' || rState === 'loading' || rState === 'buffering');
  _rHardStop();
  rIdx = (rIdx + 1) % rStations.length;
  rHistory.push(rIdx); if (rHistory.length > 50) rHistory.shift();
  rRenderStation(rStations[rIdx]);
  if (wasActive) rStartAudio();
}

function rShuffle() {
  const wasActive = (rState === 'playing' || rState === 'loading' || rState === 'buffering');
  _rHardStop();
  const prev = rIdx;
  while (rStations.length > 1 && rIdx === prev) rIdx = Math.floor(Math.random() * rStations.length);
  rHistory.push(rIdx); if (rHistory.length > 50) rHistory.shift();
  rRenderStation(rStations[rIdx]);
  if (wasActive) rStartAudio();
}

// ── MEDIA SESSION (iOS lock screen controls) ──────────────────────────────────
// Sets up lock screen prev/next buttons to change station instead of seek ±10s.
// Called every time a station starts playing so metadata stays current.

function rPrev() {
  if (rScanLocked) { rShowLockedHint(); return; }
  if (rHistory.length < 2) return; // nowhere to go back to
  const wasActive = (rState === 'playing' || rState === 'loading' || rState === 'buffering');
  _rHardStop();
  rHistory.pop(); // remove current
  rIdx = rHistory[rHistory.length - 1]; // restore previous
  rRenderStation(rStations[rIdx]);
  rUpdateMediaSession();
  if (wasActive) rStartAudio();
}

function rUpdateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const s = rStations[rIdx];
  if (!s) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  cleanStationName(s.name),
    artist: rNowStamp.country || 'Subluna Radio',
    album:  'SUBLUNA',
    // artwork tells iOS this is a "track" rather than a stream,
    // which switches the lock screen from seek±10s to prev/next buttons
    artwork: [
      { src: '/IMAGES/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  });

  // Only define prev/next — deliberately omit seekforward/seekbackward so
  // iOS shows ⏮⏭ track buttons rather than the ±10s seek buttons.
  navigator.mediaSession.setActionHandler('previoustrack', () => { rPrev(); });
  navigator.mediaSession.setActionHandler('nexttrack',     () => { rSkip(); });

  // Play/pause from the lock screen
  navigator.mediaSession.setActionHandler('play',  () => { if (rState !== 'playing') rStartAudio(); });
  navigator.mediaSession.setActionHandler('pause', () => { if (rState === 'playing' || rState === 'loading' || rState === 'buffering') rStopAudio(); });

  // Explicitly null out seek handlers so iOS can't fall back to them
  try { navigator.mediaSession.setActionHandler('seekforward',  null); } catch(e) {}
  try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch(e) {}
}

function rSyncMediaSessionState() {
  if (!('mediaSession' in navigator)) return;
  if (rState === 'playing')  navigator.mediaSession.playbackState = 'playing';
  else if (rState === 'stopped') navigator.mediaSession.playbackState = 'paused';
  else navigator.mediaSession.playbackState = 'none';
}

// Hook into existing audio events to keep Media Session in sync
aud.addEventListener('playing', () => {
  rUpdateMediaSession();
  rSyncMediaSessionState();
});
aud.addEventListener('pause', () => { rSyncMediaSessionState(); });
aud.addEventListener('ended', () => { rSyncMediaSessionState(); });
