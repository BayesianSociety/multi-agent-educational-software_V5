import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, createStore } from '../backend/src/db.js';

const REQUIRED_TABLES = [
  'users',
  'sessions',
  'puzzles',
  'attempts',
  'events',
  'movements',
  'puzzle_progress'
];

const REQUIRED_ENDPOINT_SNIPPETS = [
  "method === 'GET' && path === '/health'",
  "method === 'GET' && path === '/api/levels'",
  "method === 'GET' && path.startsWith('/api/levels/')",
  "method === 'POST' && path === '/api/session/start'",
  "method === 'POST' && path === '/api/session/end'",
  "method === 'POST' && path === '/api/events/batch'",
  "method === 'GET' && path === '/api/analytics/dashboard'",
  "method === 'GET' && path.startsWith('/api/analytics/puzzle/')",
  "method === 'GET' && path === '/api/analytics/events'"
];

function writeDeterministicAttempt(store, ids) {
  const {
    sessionId,
    userId,
    attemptId,
    playEventId,
    runStartEventId,
    moveEventId,
    runEndEventId,
    completedEventId,
    baseTs
  } = ids;

  store.createSession({
    id: sessionId,
    userId,
    userAgent: 'node_test_runner',
    locale: 'en-US',
    startedAt: baseTs
  });

  const snapshot = JSON.stringify({ connectedBlocks: [{ id: 'b1', type: 'walk' }], disconnectedBlocks: [] });

  store.insertEventBatch([
    {
      id: playEventId,
      session_id: sessionId,
      user_id: userId,
      attempt_id: attemptId,
      puzzle_id: 1,
      ts: baseTs + 1,
      type: 'ui.play_clicked',
      payload_json: JSON.stringify({ puzzle_id: 1 })
    },
    {
      id: runStartEventId,
      session_id: sessionId,
      user_id: userId,
      attempt_id: attemptId,
      puzzle_id: 1,
      ts: baseTs + 10,
      type: 'run.started',
      payload_json: JSON.stringify({
        code_snapshot_json: snapshot,
        block_count: 1,
        client_version: 'frontend_v1'
      })
    },
    {
      id: moveEventId,
      session_id: sessionId,
      user_id: userId,
      attempt_id: attemptId,
      puzzle_id: 1,
      ts: baseTs + 20,
      type: 'move.step',
      payload_json: JSON.stringify({
        fromX: 0,
        fromY: 0,
        toX: 1,
        toY: 0,
        direction: 'E',
        cause: 'walk',
        blocked: false
      })
    },
    {
      id: runEndEventId,
      session_id: sessionId,
      user_id: userId,
      attempt_id: attemptId,
      puzzle_id: 1,
      ts: baseTs + 30,
      type: 'run.ended',
      payload_json: JSON.stringify({
        result: 'success',
        failure_reason: null,
        execution_steps: 1,
        code_snapshot_json: snapshot,
        block_count: 1,
        client_version: 'frontend_v1'
      })
    },
    {
      id: completedEventId,
      session_id: sessionId,
      user_id: userId,
      attempt_id: attemptId,
      puzzle_id: 1,
      ts: baseTs + 40,
      type: 'puzzle.completed',
      payload_json: JSON.stringify({ puzzle_id: 1 })
    }
  ]);

  store.endSession({ id: sessionId, endedAt: baseTs + 50 });
}

test('backend store persists telemetry and returns analytics readback deterministically', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'pet-vet-backend-test-'));
  const sqlitePath = join(tempDir, 'integration.sqlite');
  const db = createDatabase(sqlitePath);
  const store = createStore(db);

  try {
    writeDeterministicAttempt(store, {
      sessionId: 'session_test_backend_1',
      userId: 'user_test_backend',
      attemptId: 'attempt_test_backend_1',
      playEventId: 'evt_1',
      runStartEventId: 'evt_2',
      moveEventId: 'evt_3',
      runEndEventId: 'evt_4',
      completedEventId: 'evt_5',
      baseTs: 1_700_000_000_000
    });

    const dashboard = store.getDashboard();
    assert.equal(dashboard.totalSessions, 1);
    assert.equal(dashboard.totalAttempts, 1);
    assert.equal(dashboard.successRate, 1);
    assert.equal(dashboard.averageAttemptsPerPuzzle, 1);
    assert.equal(dashboard.averageTimePerPuzzleMs, 20);

    const puzzleAnalytics = store.getPuzzleAnalytics(1);
    assert.equal(puzzleAnalytics.puzzleId, 1);
    assert.equal(puzzleAnalytics.attemptCount, 1);
    assert.equal(puzzleAnalytics.attempts[0].id, 'attempt_test_backend_1');
    assert.equal(puzzleAnalytics.attempts[0].result, 'success');
    assert.equal(puzzleAnalytics.attempts[0].execution_steps, 1);
    assert.equal(puzzleAnalytics.attempts[0].movements.length, 1);
    assert.equal(puzzleAnalytics.attempts[0].movements[0].from_x, 0);
    assert.equal(puzzleAnalytics.attempts[0].movements[0].to_x, 1);
    assert.equal(puzzleAnalytics.attempts[0].movementReplay.length, 2);

    const events = store.getEvents({
      sessionId: 'session_test_backend_1',
      puzzleId: 1,
      attemptId: 'attempt_test_backend_1',
      limit: 50
    });
    assert.equal(events.length, 5);
    assert.equal(events[0].id, 'evt_5');
    assert.equal(events[4].id, 'evt_1');
  } finally {
    store.close();
  }
});

test('persistence survives database reopen with deterministic readback', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'pet-vet-reopen-test-'));
  const sqlitePath = join(tempDir, 'integration.sqlite');

  {
    const db = createDatabase(sqlitePath);
    const store = createStore(db);
    try {
      writeDeterministicAttempt(store, {
        sessionId: 'session_reopen_1',
        userId: 'user_reopen_1',
        attemptId: 'attempt_reopen_1',
        playEventId: 'evt_reopen_1',
        runStartEventId: 'evt_reopen_2',
        moveEventId: 'evt_reopen_3',
        runEndEventId: 'evt_reopen_4',
        completedEventId: 'evt_reopen_5',
        baseTs: 1_700_000_100_000
      });
    } finally {
      store.close();
    }
  }

  {
    const reopenedDb = createDatabase(sqlitePath);
    const reopenedStore = createStore(reopenedDb);
    try {
      const dashboard = reopenedStore.getDashboard();
      assert.equal(dashboard.totalSessions, 1);
      assert.equal(dashboard.totalAttempts, 1);
      assert.equal(dashboard.successRate, 1);

      const puzzle = reopenedStore.getPuzzleAnalytics(1);
      assert.equal(puzzle.attemptCount, 1);
      assert.equal(puzzle.attempts[0].id, 'attempt_reopen_1');
      assert.equal(
        puzzle.attempts[0].code_snapshot_json,
        JSON.stringify({ connectedBlocks: [{ id: 'b1', type: 'walk' }], disconnectedBlocks: [] })
      );
      assert.equal(puzzle.attempts[0].movements.length, 1);
      assert.equal(puzzle.attempts[0].movementReplay.length, 2);

      const events = reopenedStore.getEvents({
        sessionId: 'session_reopen_1',
        puzzleId: 1,
        attemptId: 'attempt_reopen_1',
        limit: 10
      });
      assert.equal(events.length, 5);
      assert.equal(events[0].id, 'evt_reopen_5');
      assert.equal(events[4].id, 'evt_reopen_1');
    } finally {
      reopenedStore.close();
    }
  }
});

test('sqlite schema initializes required contract tables', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'pet-vet-schema-test-'));
  const sqlitePath = join(tempDir, 'integration.sqlite');
  const db = createDatabase(sqlitePath);

  try {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    const tableSet = new Set(rows.map((row) => row.name));
    for (const tableName of REQUIRED_TABLES) {
      assert.equal(tableSet.has(tableName), true, `missing table: ${tableName}`);
    }
  } finally {
    db.close();
  }
});

test('backend route definitions include required endpoint contract', () => {
  const source = readFileSync(new URL('../backend/src/server.js', import.meta.url), 'utf-8');
  for (const snippet of REQUIRED_ENDPOINT_SNIPPETS) {
    assert.equal(source.includes(snippet), true, `missing route condition: ${snippet}`);
  }
});
