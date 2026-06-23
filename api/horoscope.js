// api/horoscope.js — proxy for freehoroscopeapi.com (no CORS headers on their end)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sign, period = 'daily' } = req.query;
  if (!sign) return res.status(400).json({ error: 'sign required' });

  const validPeriods = ['daily', 'weekly', 'monthly'];
  const validSigns = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
  if (!validPeriods.includes(period)) return res.status(400).json({ error: 'invalid period' });
  if (!validSigns.includes(sign.toLowerCase())) return res.status(400).json({ error: 'invalid sign' });

  try {
    const url = `https://freehoroscopeapi.com/api/v1/get-horoscope/${period}?sign=${sign.toLowerCase()}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
