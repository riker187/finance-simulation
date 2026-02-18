const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = Number(process.env.SYNC_PORT || 8787);
const DATA_FILE = process.env.SYNC_DATA_FILE || '/data/state.json';

function emptyData() {
  return { situations: [], scenarios: [] };
}

function isValidData(data) {
  return data && Array.isArray(data.situations) && Array.isArray(data.scenarios);
}

function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!isValidData(parsed.data)) return null;
    return {
      version: Number(parsed.version) || 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      data: parsed.data,
    };
  } catch {
    return null;
  }
}

let state =
  loadState() || {
    version: 0,
    updatedAt: new Date().toISOString(),
    data: emptyData(),
  };

function persistState() {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

const clients = new Set();

function sendJson(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function broadcast(payload) {
  const packet = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    client.write(packet);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(res, 200, state);
  }

  if (req.method === 'PUT' && url.pathname === '/api/state') {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw || '{}');
      if (!isValidData(parsed.data)) {
        return sendJson(res, 400, { ok: false, error: 'invalid_data' });
      }

      state = {
        version: state.version + 1,
        updatedAt: new Date().toISOString(),
        data: parsed.data,
      };

      persistState();

      const eventPayload = {
        ...state,
        clientId: typeof parsed.clientId === 'string' ? parsed.clientId : undefined,
      };
      broadcast(eventPayload);

      return sendJson(res, 200, { ok: true, version: state.version, updatedAt: state.updatedAt });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: 'bad_request', details: String(err.message || err) });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    res.write('retry: 2000\n\n');
    res.write(`data: ${JSON.stringify(state)}\n\n`);
    clients.add(res);

    req.on('close', () => {
      clients.delete(res);
      res.end();
    });
    return;
  }

  return sendJson(res, 404, { ok: false, error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`sync-server listening on :${PORT}`);
});
