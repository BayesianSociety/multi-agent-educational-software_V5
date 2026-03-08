import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { LEVELS } from './levels.js';

const ATTEMPT_RESULTS = new Set(['success', 'failure', 'aborted']);

function normalizeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.trunc(n);
}

function parsePayload(payloadJson) {
  if (typeof payloadJson !== 'string') {
    return {};
  }
  try {
    const parsed = JSON.parse(payloadJson);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    return {};
  }
  return {};
}

function conceptsForPuzzle(id) {
  if (id <= 5) {
    return 'sequencing';
  }
  if (id <= 10) {
    return 'sequencing,loops';
  }
  return 'sequencing,loops,conditionals';
}

function buildMovementReplay(movements) {
  if (movements.length === 0) {
    return [];
  }

  const replay = [
    {
      ts: movements[0].ts,
      x: movements[0].from_x,
      y: movements[0].from_y,
      direction: movements[0].direction,
      cause: 'start',
      blocked: 0
    }
  ];

  for (const movement of movements) {
    replay.push({
      ts: movement.ts,
      x: movement.to_x,
      y: movement.to_y,
      direction: movement.direction,
      cause: movement.cause,
      blocked: movement.blocked
    });
  }

  return replay;
}

export function createDatabase(sqlitePath) {
  mkdirSync(dirname(sqlitePath), { recursive: true });
  const db = new DatabaseSync(sqlitePath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      display_name TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      user_agent TEXT,
      locale TEXT
    );

    CREATE TABLE IF NOT EXISTS puzzles (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      concepts TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      user_id TEXT REFERENCES users(id),
      puzzle_id INTEGER REFERENCES puzzles(id),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      result TEXT CHECK(result IN ('success','failure','aborted')) NOT NULL,
      failure_reason TEXT,
      code_snapshot_json TEXT NOT NULL,
      block_count INTEGER NOT NULL,
      execution_steps INTEGER NOT NULL,
      client_version TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT,
      attempt_id TEXT,
      puzzle_id INTEGER,
      ts INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES attempts(id),
      ts INTEGER NOT NULL,
      entity TEXT NOT NULL,
      from_x INTEGER NOT NULL,
      from_y INTEGER NOT NULL,
      to_x INTEGER NOT NULL,
      to_y INTEGER NOT NULL,
      direction TEXT,
      cause TEXT NOT NULL,
      blocked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS puzzle_progress (
      user_id TEXT NOT NULL,
      puzzle_id INTEGER NOT NULL,
      completed_at INTEGER,
      best_attempt_id TEXT,
      PRIMARY KEY (user_id, puzzle_id)
    );
  `);

  const insertPuzzle = db.prepare('INSERT OR IGNORE INTO puzzles (id, title, concepts) VALUES (?, ?, ?)');
  for (const level of LEVELS) {
    insertPuzzle.run(level.id, level.title, conceptsForPuzzle(level.id));
  }

  return db;
}

export function createStore(db) {
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, created_at, display_name) VALUES (?, ?, ?)');
  const insertSession = db.prepare(
    'INSERT OR REPLACE INTO sessions (id, user_id, started_at, ended_at, user_agent, locale) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const endSessionStmt = db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?');

  const insertEvent = db.prepare(
    'INSERT OR REPLACE INTO events (id, session_id, user_id, attempt_id, puzzle_id, ts, type, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const insertAttemptStart = db.prepare(
    `INSERT OR IGNORE INTO attempts (
      id, session_id, user_id, puzzle_id, started_at, ended_at, result,
      failure_reason, code_snapshot_json, block_count, execution_steps, client_version
    ) VALUES (?, ?, ?, ?, ?, NULL, 'aborted', NULL, ?, ?, 0, ?)`
  );

  const insertAttemptFallback = db.prepare(
    `INSERT OR IGNORE INTO attempts (
      id, session_id, user_id, puzzle_id, started_at, ended_at, result,
      failure_reason, code_snapshot_json, block_count, execution_steps, client_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const updateAttemptEnd = db.prepare(
    `UPDATE attempts
     SET ended_at = ?,
         result = ?,
         failure_reason = ?,
         execution_steps = ?,
         code_snapshot_json = ?,
         block_count = ?,
         client_version = COALESCE(?, client_version)
     WHERE id = ?`
  );

  const insertMovement = db.prepare(
    `INSERT OR REPLACE INTO movements (
      id, attempt_id, ts, entity, from_x, from_y, to_x, to_y, direction, cause, blocked
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const upsertProgress = db.prepare(
    `INSERT INTO puzzle_progress (user_id, puzzle_id, completed_at, best_attempt_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, puzzle_id)
     DO UPDATE SET
       completed_at = CASE
         WHEN excluded.completed_at IS NULL THEN puzzle_progress.completed_at
         WHEN puzzle_progress.completed_at IS NULL THEN excluded.completed_at
         WHEN excluded.completed_at < puzzle_progress.completed_at THEN excluded.completed_at
         ELSE puzzle_progress.completed_at
       END,
       best_attempt_id = COALESCE(excluded.best_attempt_id, puzzle_progress.best_attempt_id)`
  );

  const getDashboardStmt = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sessions) AS total_sessions,
      (SELECT COUNT(*) FROM attempts) AS total_attempts,
      (SELECT COUNT(*) FROM attempts WHERE result = 'success') AS successful_attempts,
      (SELECT AVG(attempts_per_puzzle)
         FROM (SELECT puzzle_id, COUNT(*) AS attempts_per_puzzle FROM attempts GROUP BY puzzle_id)
      ) AS avg_attempts_per_puzzle,
      (SELECT AVG(duration_ms)
         FROM (SELECT puzzle_id, AVG(ended_at - started_at) AS duration_ms
               FROM attempts
               WHERE ended_at IS NOT NULL
               GROUP BY puzzle_id)
      ) AS avg_time_per_puzzle_ms
  `);

  const getPuzzleAttemptsStmt = db.prepare(`
    SELECT
      id,
      session_id,
      user_id,
      puzzle_id,
      started_at,
      ended_at,
      result,
      failure_reason,
      code_snapshot_json,
      block_count,
      execution_steps,
      client_version
    FROM attempts
    WHERE puzzle_id = ?
    ORDER BY started_at ASC
  `);

  const getPuzzleMetaStmt = db.prepare(`
    SELECT id, title, concepts
    FROM puzzles
    WHERE id = ?
    LIMIT 1
  `);

  const getMovementsByAttemptStmt = db.prepare(`
    SELECT id, attempt_id, ts, entity, from_x, from_y, to_x, to_y, direction, cause, blocked
    FROM movements
    WHERE attempt_id = ?
    ORDER BY ts ASC, id ASC
  `);

  function createSession({ id, userId, userAgent, locale, startedAt }) {
    insertUser.run(userId, startedAt, null);
    insertSession.run(id, userId, startedAt, null, userAgent ?? null, locale ?? null);
  }

  function endSession({ id, endedAt }) {
    endSessionStmt.run(endedAt, id);
  }

  function insertEventBatch(events) {
    db.exec('BEGIN');
    try {
      for (const event of events) {
        const payloadJson = typeof event.payload_json === 'string' ? event.payload_json : '{}';
        const payload = parsePayload(payloadJson);
        const ts = normalizeInt(event.ts, Date.now());

        insertEvent.run(
          String(event.id),
          String(event.session_id),
          event.user_id ? String(event.user_id) : null,
          event.attempt_id ? String(event.attempt_id) : null,
          event.puzzle_id == null ? null : normalizeInt(event.puzzle_id, null),
          ts,
          String(event.type),
          payloadJson
        );

        if (!event.attempt_id) {
          continue;
        }

        const attemptId = String(event.attempt_id);
        const sessionId = String(event.session_id);
        const userId = event.user_id ? String(event.user_id) : null;
        const puzzleId = event.puzzle_id == null ? null : normalizeInt(event.puzzle_id, null);

        if (event.type === 'run.started') {
          insertAttemptStart.run(
            attemptId,
            sessionId,
            userId,
            puzzleId,
            ts,
            typeof payload.code_snapshot_json === 'string' ? payload.code_snapshot_json : '{}',
            normalizeInt(payload.block_count, 0),
            payload.client_version == null ? null : String(payload.client_version)
          );
          continue;
        }

        if (event.type === 'run.ended') {
          const resultValue = typeof payload.result === 'string' && ATTEMPT_RESULTS.has(payload.result)
            ? payload.result
            : 'failure';
          const codeSnapshot = typeof payload.code_snapshot_json === 'string' ? payload.code_snapshot_json : '{}';
          const blockCount = normalizeInt(payload.block_count, 0);
          const executionSteps = normalizeInt(payload.execution_steps, 0);
          const failureReason = payload.failure_reason == null ? null : String(payload.failure_reason);
          const clientVersion = payload.client_version == null ? null : String(payload.client_version);

          insertAttemptFallback.run(
            attemptId,
            sessionId,
            userId,
            puzzleId,
            ts,
            ts,
            resultValue,
            failureReason,
            codeSnapshot,
            blockCount,
            executionSteps,
            clientVersion
          );

          updateAttemptEnd.run(
            ts,
            resultValue,
            failureReason,
            executionSteps,
            codeSnapshot,
            blockCount,
            clientVersion,
            attemptId
          );
          continue;
        }

        if (event.type === 'move.step') {
          const fromX = normalizeInt(payload.fromX, 0);
          const fromY = normalizeInt(payload.fromY, 0);
          const toX = normalizeInt(payload.toX, fromX);
          const toY = normalizeInt(payload.toY, fromY);

          insertMovement.run(
            `${String(event.id)}:move`,
            attemptId,
            ts,
            'assistant',
            fromX,
            fromY,
            toX,
            toY,
            payload.direction == null ? null : String(payload.direction),
            payload.cause == null ? 'walk' : String(payload.cause),
            payload.blocked ? 1 : 0
          );
          continue;
        }

        if (event.type === 'puzzle.completed' && userId && puzzleId != null) {
          upsertProgress.run(userId, puzzleId, ts, attemptId);
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function getDashboard() {
    const row = getDashboardStmt.get();
    const attempts = normalizeInt(row.total_attempts, 0);
    const successes = normalizeInt(row.successful_attempts, 0);

    return {
      totalSessions: normalizeInt(row.total_sessions, 0),
      totalAttempts: attempts,
      successRate: attempts === 0 ? 0 : Number((successes / attempts).toFixed(4)),
      averageAttemptsPerPuzzle: Number((Number(row.avg_attempts_per_puzzle) || 0).toFixed(4)),
      averageTimePerPuzzleMs: Math.trunc(Number(row.avg_time_per_puzzle_ms) || 0)
    };
  }

  function getPuzzleAnalytics(puzzleId) {
    const attempts = getPuzzleAttemptsStmt.all(puzzleId).map((attempt) => ({
      ...attempt,
      movements: getMovementsByAttemptStmt.all(attempt.id)
    }));
    const puzzle = getPuzzleMetaStmt.get(puzzleId) ?? null;
    const attemptsWithReplay = attempts.map((attempt) => ({
      ...attempt,
      movementReplay: buildMovementReplay(attempt.movements)
    }));
    const timeline = attemptsWithReplay.map((attempt) => ({
      attempt_id: attempt.id,
      started_at: attempt.started_at,
      ended_at: attempt.ended_at,
      result: attempt.result,
      failure_reason: attempt.failure_reason,
      execution_steps: attempt.execution_steps
    }));

    return {
      puzzleId,
      puzzle,
      attempts: attemptsWithReplay,
      timeline,
      attemptCount: attemptsWithReplay.length
    };
  }

  function getEvents({ sessionId, puzzleId, attemptId, limit }) {
    const where = [];
    const values = [];

    if (sessionId) {
      where.push('session_id = ?');
      values.push(sessionId);
    }
    if (puzzleId != null) {
      where.push('puzzle_id = ?');
      values.push(puzzleId);
    }
    if (attemptId) {
      where.push('attempt_id = ?');
      values.push(attemptId);
    }

    const sql = `
      SELECT id, session_id, user_id, attempt_id, puzzle_id, ts, type, payload_json
      FROM events
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ts DESC, id DESC
      LIMIT ?
    `;

    values.push(limit);
    return db.prepare(sql).all(...values);
  }

  function close() {
    db.close();
  }

  return {
    createSession,
    endSession,
    insertEventBatch,
    getDashboard,
    getPuzzleAnalytics,
    getEvents,
    close
  };
}
