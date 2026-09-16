/**
 * Test TradingView WebSocket connection with multiple symbols.
 * Pure JS (no Python, no browser).
 */

import WebSocket from 'ws';

const WS_URL = 'wss://data.tradingview.com/socket.io/websocket';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Origin': 'https://www.tradingview.com',
  'Accept-Language': 'en-US,en;q=0.9',
};

function frame(obj) {
  const json = JSON.stringify(obj);
  return `~m~${json.length}~m~${json}`;
}

const symbolsToTest = [
  'COMEX:GC1!',
  'OANDA:XAUUSD',
  'FX_IDC:XAUUSD',
  'TVC:GOLD',
];

const results = {};
for (const sym of symbolsToTest) {
  results[sym] = { responds: false, price: null, volume: null };
}

const ws = new WebSocket(WS_URL, { headers: HEADERS });
let sessionId = '';
let startTime = Date.now();

ws.on('open', () => {
  console.log('[OPEN] Connected to TradingView');

  sessionId = `qs_${Date.now()}`;
  ws.send(frame({ m: 'quote_create_session', p: [sessionId] }));
  console.log('[SEND] quote_create_session:', sessionId);

  setTimeout(() => {
    console.log('[SEND] Subscribing to symbols:', symbolsToTest);
    ws.send(
      frame({
        m: 'quote_add_symbols',
        p: [sessionId, ...symbolsToTest],
      })
    );
  }, 500);
});

ws.on('message', (data) => {
  const raw = data.toString();

  // Answer ping/heartbeat
  if (raw.includes('~h~')) {
    const match = raw.match(/~h~(\d+)/);
    if (match) {
      ws.send(`~m~${match[0].length}~m~${match[0]}`);
    }
  }

  // Parse JSON packets in the frame
  const parts = raw.split(/~m~\d+~m~/).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith('~h~')) continue;
    try {
      const parsed = JSON.parse(part);
      if (parsed.m === 'qsd' && Array.isArray(parsed.p) && parsed.p.length >= 2) {
        const payload = parsed.p[1];
        const symName = payload.n;
        const values = payload.v;

        if (symName && results[symName]) {
          results[symName].responds = true;
          if (values && values.lp !== undefined) {
            results[symName].price = values.lp;
          }
          if (values && values.volume !== undefined) {
            results[symName].volume = values.volume;
          }
          console.log(`[DATA] ${symName} -> Price: $${results[symName].price ?? 'N/A'}, Vol: ${results[symName].volume ?? 'N/A'}`);
        }
      }
    } catch {
      // Ignore packet parse errors
    }
  }
});

ws.on('error', (err) => {
  console.error('[ERROR]', err.message);
});

ws.on('close', () => {
  printReport();
  process.exit(0);
});

function printReport() {
  console.log('\n========================================');
  console.log('RESULTS SUMMARY:');
  for (const sym of symbolsToTest) {
    const res = results[sym];
    console.log(
      `${sym}: responds ${res.responds ? 'YES' : 'NO'} | price: ${res.price !== null ? '$' + res.price : 'N/A'}`
    );
  }
  console.log('========================================\n');
}

// Timeout after 12 seconds
setTimeout(() => {
  printReport();
  ws.close();
}, 12000);
