/**
 * Test TradingView chart session protocol for historical OHLCV.
 */
import WebSocket from 'ws';

const WS_URL = 'wss://data.tradingview.com/socket.io/websocket';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: 'https://www.tradingview.com',
};

function frame(obj) {
  const json = JSON.stringify(obj);
  return `~m~${json.length}~m~${json}`;
}

const ws = new WebSocket(WS_URL, { headers: HEADERS });
const chartSession = `cs_${Date.now()}`;
let barCount = 0;
let sampleBars = [];

ws.on('open', () => {
  console.log('[OPEN] Connected');

  // Step 1: Set auth token (unauthorized_user_token)
  const authMsg = frame({
    m: 'set_auth_token',
    p: ['unauthorized_user_token'],
  });
  ws.send(authMsg);
  console.log('[SENT] set_auth_token');

  // Step 2: Create chart session
  const chartMsg = frame({
    m: 'chart_create_session',
    p: [chartSession, ''],
  });
  ws.send(chartMsg);
  console.log('[SENT] chart_create_session:', chartSession);

  // Step 3: Resolve symbol
  const resolveMsg = frame({
    m: 'resolve_symbol',
    p: [chartSession, 'sds_sym_1', '={"symbol":"COMEX:GC1!","adjustment":"splits"}'],
  });
  ws.send(resolveMsg);
  console.log('[SENT] resolve_symbol: COMEX:GC1!');

  // Step 4: Create series with bars
  const seriesMsg = frame({
    m: 'create_series',
    p: [chartSession, 'sds_1', 's1', 'sds_sym_1', '15', 300, ''],
  });
  ws.send(seriesMsg);
  console.log('[SENT] create_series (300 bars of 15m)');
});

ws.on('message', (data) => {
  const str = data.toString();

  // Heartbeat response
  if (str.includes('~h~')) {
    const match = str.match(/~h~\d+/);
    if (match) ws.send(`~m~${match[0].length}~m~${match[0]}`);
    return;
  }

  // Parse frames
  const parts = str.split(/~m~\d+~m~/).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith('~h~')) continue;
    try {
      const obj = JSON.parse(part);
      if (obj.m === 'timescale_update') {
        const seriesData = obj.p?.[1]?.sds_1?.s;
        if (Array.isArray(seriesData)) {
          barCount += seriesData.length;
          sampleBars = seriesData.slice(-5);
          console.log(`[BARS RECEIVED] Received ${seriesData.length} bars! Total: ${barCount}`);
          const last = seriesData[seriesData.length - 1];
          // TradingView bar format: { i: index, v: [time, open, high, low, close, volume] }
          if (last && last.v) {
            console.log('[LATEST BAR OHLCV]:', {
              time: new Date(last.v[0] * 1000).toISOString(),
              open: last.v[1],
              high: last.v[2],
              low: last.v[3],
              close: last.v[4],
              volume: last.v[5],
            });
          }
        }
      } else if (obj.m === 'series_completed') {
        console.log('[SERIES COMPLETED] All requested historical bars loaded!');
        setTimeout(() => ws.close(), 1000);
      } else {
        console.log(`[EVENT: ${obj.m}]`);
      }
    } catch {
      // ignore
    }
  }
});

ws.on('error', (err) => console.error('[ERROR]', err.message));

ws.on('close', (code) => {
  console.log(`[CLOSE] code=${code}, total bars=${barCount}`);
  if (sampleBars.length > 0) {
    console.log('[SAMPLE 5 BARS]:', JSON.stringify(sampleBars, null, 2));
  }
  process.exit(0);
});

setTimeout(() => {
  console.log(`[TIMEOUT] bars received: ${barCount}`);
  ws.close();
}, 15000);
