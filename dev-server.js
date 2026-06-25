const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

// Mock horoscope data for quick testing
const mockHoroscopes = {
  'aries': { data: { horoscope: 'The stars align in your favor today. A surge of confidence propels you forward. Expect unexpected opportunities in matters of the heart. Your natural charisma draws admirers. Trust your instincts—they\'re sharper than usual. Financial winds favor bold moves, but temper ambition with wisdom. Evening brings meaningful connections.' } },
  'taurus': { data: { horoscope: 'Stability is your theme today. The cosmos encourages you to plant seeds for long-term growth. Relationships deepen through honest conversation. Financial matters stabilize. A creative impulse emerges—nurture it. Avoid resistance to change; flexibility is your strength. The day ends on a peaceful note.' } },
  'gemini': { data: { horoscope: 'Communication flows effortlessly under today\'s celestial climate. Your words carry weight. It\'s an ideal moment for negotiations and declarations. Connections, both professional and personal, strengthen. Curiosity leads you to fascinating discoveries. A travel or learning opportunity may surface. Evening brings laughter and lightness.' } },
  'cancer': { data: { horoscope: 'Your home and emotional world take center stage. Nurturing others or yourself brings deep satisfaction. Family matters resolve favorably. Creative expression flows naturally. Financial security feels within reach. A intimate conversation opens doors. The stars suggest rest and reflection as evening approaches.' } },
  'leo': { data: { horoscope: 'Your creative fire burns bright. Self-expression is your superpower today. Romance blossoms—whether new or rekindled. Professional recognition may come unexpectedly. Collaboration brings joy. Risk calculated moves in pursuit of dreams. Generosity flows easily. The day celebrates your authenticity.' } },
  'virgo': { data: { horoscope: 'Home improvements and domestic harmony align with cosmic energy. Details matter today—your precision shines. Financial prudence pays dividends. A practical solution to a lingering issue emerges. Health and wellness improvements begin now. The evening invites quiet satisfaction and well-earned rest.' } }
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoint: horoscope
  if (pathname === '/api/horoscope') {
    const sign = (query.sign || 'aries').toLowerCase();
    const mockData = mockHoroscopes[sign] || mockHoroscopes['aries'];
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData));
    return;
  }

  // Serve index.html and static files from current directory
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found: ' + filePath);
      } else {
        res.writeHead(500);
        res.end('Server error: ' + err.message);
      }
      return;
    }

    // Determine content type
    const ext = path.extname(filePath);
    let contentType = 'text/plain';
    if (ext === '.html') contentType = 'text/html';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.css') contentType = 'text/css';
    else if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.woff2') contentType = 'font/woff2';
    else if (ext === '.woff') contentType = 'font/woff';
    else if (ext === '.ttf') contentType = 'font/ttf';
    else if (ext === '.gif') contentType = 'image/gif';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🌙 SUBLUNA dev server running`);
  console.log(`📡 http://localhost:${PORT}\n`);
});
