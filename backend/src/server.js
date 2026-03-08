import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createDatabase, createStore } from './db.js';
import { LEVELS, getLevelById } from './levels.js';

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        rejectBody(new Error('payload_too_large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(body));
      } catch {
        rejectBody(new Error('invalid_json'));
      }
    });
    req.on('error', rejectBody);
  });
}

function intFromQuery(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.trunc(n);
}

function isValidBatchEvent(event) {
  return Boolean(
    event &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    typeof event.session_id === 'string' &&
    typeof event.type === 'string'
  );
}

export function createApp({ sqlitePath = resolve(process.cwd(), 'backend/data/pet_vet_puzzles.sqlite') } = {}) {
  const db = createDatabase(sqlitePath);
  const store = createStore(db);

  const server = createHttpServer(async (req, res) => {
    try {
      const method = req.method ?? 'GET';
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type'
        });
        res.end();
        return;
      }

      if (method === 'GET' && path === '/health') {
        json(res, 200, { status: 'ok' });
        return;
      }

      if (method === 'GET' && path === '/api/levels') {
        json(res, 200, LEVELS);
        return;
      }

      if (method === 'GET' && path.startsWith('/api/levels/')) {
        const id = intFromQuery(path.split('/').pop(), NaN);
        const level = getLevelById(id);
        if (!level) {
          json(res, 404, { error: 'level_not_found' });
          return;
        }
        json(res, 200, level);
        return;
      }

      if (method === 'POST' && path === '/api/session/start') {
        const body = await readJsonBody(req);
        const startedAt = Date.now();
        const sessionId = typeof body.id === 'string' ? body.id : `session_${randomUUID()}`;
        const userId = typeof body.user_id === 'string' ? body.user_id : `user_${randomUUID()}`;

        store.createSession({
          id: sessionId,
          userId,
          userAgent: typeof body.user_agent === 'string' ? body.user_agent : null,
          locale: typeof body.locale === 'string' ? body.locale : null,
          startedAt
        });

        json(res, 200, { id: sessionId, user_id: userId, started_at: startedAt });
        return;
      }

      if (method === 'POST' && path === '/api/session/end') {
        const body = await readJsonBody(req);
        if (typeof body.id !== 'string') {
          json(res, 400, { error: 'invalid_session_id' });
          return;
        }

        store.endSession({
          id: body.id,
          endedAt: intFromQuery(body.ended_at, Date.now())
        });

        json(res, 200, { ok: true });
        return;
      }

      if (method === 'POST' && path === '/api/events/batch') {
        const body = await readJsonBody(req);
        if (!body || !Array.isArray(body.events)) {
          json(res, 400, { error: 'invalid_events' });
          return;
        }

        const invalidCount = body.events.reduce((count, event) => (isValidBatchEvent(event) ? count : count + 1), 0);
        if (invalidCount > 0) {
          json(res, 400, { error: 'invalid_event_shape', invalid_count: invalidCount });
          return;
        }

        store.insertEventBatch(body.events);
        json(res, 200, { accepted: body.events.length, rejected: 0 });
        return;
      }

      if (method === 'GET' && path === '/api/analytics/dashboard') {
        json(res, 200, store.getDashboard());
        return;
      }

      if (method === 'GET' && path.startsWith('/api/analytics/puzzle/')) {
        const puzzleId = intFromQuery(path.split('/').pop(), NaN);
        if (!Number.isInteger(puzzleId) || puzzleId < 1 || puzzleId > 17) {
          json(res, 400, { error: 'invalid_puzzle_id' });
          return;
        }

        json(res, 200, store.getPuzzleAnalytics(puzzleId));
        return;
      }

      if (method === 'GET' && path === '/api/analytics/events') {
        const limit = Math.min(5000, Math.max(1, intFromQuery(url.searchParams.get('limit'), 200)));
        const puzzleIdRaw = url.searchParams.get('puzzle_id');

        const events = store.getEvents({
          sessionId: url.searchParams.get('session_id'),
          puzzleId: puzzleIdRaw == null ? null : intFromQuery(puzzleIdRaw, null),
          attemptId: url.searchParams.get('attempt_id'),
          limit
        });

        json(res, 200, { events, count: events.length });
        return;
      }

      json(res, 404, { error: 'not_found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      json(res, 500, { error: message });
    }
  });

  server.on('close', () => {
    store.close();
  });

  return server;
}

export function startServer({ port = Number(process.env.PORT ?? 3000), sqlitePath = process.env.SQLITE_PATH } = {}) {
  const resolvedDbPath = sqlitePath
    ? resolve(process.cwd(), sqlitePath)
    : resolve(process.cwd(), 'backend/data/pet_vet_puzzles.sqlite');
  const server = createApp({ sqlitePath: resolvedDbPath });
  server.listen(port);
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = startServer();
  server.on('listening', () => {
    const address = server.address();
    if (address && typeof address === 'object') {
      // Deterministic machine-readable startup line.
      console.log(`backend_listening:${address.port}`);
    }
  });
}
