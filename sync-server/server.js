const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = Number(process.env.SYNC_PORT || 8787);
const DATA_FILE = process.env.SYNC_DATA_FILE || '/data/state.json';
const DATA_DIR = path.dirname(DATA_FILE);

function emptyData() {
  return { situations: [], scenarios: [] };
}

function isValidData(data) {
  return data && Array.isArray(data.situations) && Array.isArray(data.scenarios);
}

// Sanitize profile ID to safe filename characters
function safeProfile(profile) {
  if (!profile || profile === 'default') return 'default';
  return String(profile).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default';
}

function profileFile(profile) {
  if (profile === 'default') return DATA_FILE;
  return path.join(DATA_DIR, `state-${profile}.json`);
}

function loadStateFromFile(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
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

function emptyState() {
  return { version: 0, updatedAt: new Date().toISOString(), data: emptyData() };
}

// Per-profile in-memory state cache
const profileStates = new Map();

// Per-profile SSE client sets: Map<profileId, Set<res>>
const profileClients = new Map();

function getState(profile) {
  if (!profileStates.has(profile)) {
    const loaded = loadStateFromFile(profileFile(profile));
    profileStates.set(profile, loaded || emptyState());
  }
  return profileStates.get(profile);
}

function setState(profile, newState) {
  profileStates.set(profile, newState);
  const file = profileFile(profile);
  const dir = path.dirname(file);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(newState, null, 2));
  } catch (err) {
    console.error(`Failed to persist state for profile ${profile}:`, err.message);
  }
}

function getClients(profile) {
  if (!profileClients.has(profile)) {
    profileClients.set(profile, new Set());
  }
  return profileClients.get(profile);
}

function broadcastToProfile(profile, payload) {
  const packet = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of getClients(profile)) {
    try {
      client.write(packet);
    } catch {
      // client disconnected
    }
  }
}

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const profile = safeProfile(url.searchParams.get('profile'));

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(res, 200, getState(profile));
  }

  if (req.method === 'PUT' && url.pathname === '/api/state') {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw || '{}');
      if (!isValidData(parsed.data)) {
        return sendJson(res, 400, { ok: false, error: 'invalid_data' });
      }

      const current = getState(profile);
      const newState = {
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
        data: parsed.data,
      };

      setState(profile, newState);

      const eventPayload = {
        ...newState,
        clientId: typeof parsed.clientId === 'string' ? parsed.clientId : undefined,
      };
      broadcastToProfile(profile, eventPayload);

      return sendJson(res, 200, { ok: true, version: newState.version, updatedAt: newState.updatedAt });
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

    const clients = getClients(profile);
    const state = getState(profile);

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
