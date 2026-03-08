import { useEffect, useMemo, useRef, useState } from 'react';
import { endSession, fetchLevels, startSession } from './lib/api';
import { runProgram } from './lib/engine';
import { createId } from './lib/id';
import { TelemetryClient } from './lib/telemetry';
import { PUZZLES, getPuzzleById } from './data/puzzles';
import type { AvailableBlock, ProgramBlock, PuzzleDefinition, RuntimeResult, Symptom } from './types';

type Screen = 'landing' | 'levels' | 'puzzle';

const PROGRESS_KEY = 'pet_vet_progress_v1';
const USER_KEY = 'pet_vet_user_v1';
const CLIENT_VERSION = 'frontend_v1';

function toCode(blocks: ProgramBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === 'repeat') {
        return `repeat(${String(block.params.count ?? 2)}) -> ${String(block.params.targetBlockId ?? 'none')}`;
      }
      if (block.type === 'ifSymptom' || block.type === 'checkSymptom') {
        return `${block.type}(${String(block.params.symptom ?? 'sniffles')})`;
      }
      if (block.type === 'pickup' || block.type === 'treat') {
        return `${block.type}(${String(block.params.item ?? 'medicine')})`;
      }
      return `${block.type}()`;
    })
    .join('\n');
}

function categoryOrder(category: AvailableBlock['category']): number {
  return ['Movement', 'Actions', 'Control', 'Logic', 'Sensing'].indexOf(category);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>('landing');
  const [levels, setLevels] = useState<PuzzleDefinition[]>(PUZZLES);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState(1);
  const [connectedBlocks, setConnectedBlocks] = useState<ProgramBlock[]>([]);
  const [disconnectedBlocks, setDisconnectedBlocks] = useState<ProgramBlock[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [runResult, setRunResult] = useState<RuntimeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<number[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('session_local_boot');

  const userIdRef = useRef<string>('learner_local');
  const sessionIdRef = useRef<string>('session_local_boot');
  const telemetryRef = useRef<TelemetryClient | null>(null);

  const puzzle = useMemo(() => getPuzzleById(selectedPuzzleId) ?? levels[0], [levels, selectedPuzzleId]);

  useEffect(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { completed: number[] };
        setCompleted(parsed.completed.filter((id) => id >= 1 && id <= 17));
      } catch {
        setCompleted([]);
      }
    }

    const existingUser = localStorage.getItem(USER_KEY);
    if (existingUser) {
      userIdRef.current = existingUser;
    } else {
      const newUser = createId('user');
      userIdRef.current = newUser;
      localStorage.setItem(USER_KEY, newUser);
    }

    void fetchLevels().then((apiLevels) => {
      if (apiLevels.length === 17) {
        setLevels(apiLevels);
      }
    });

    void startSession({
      user_id: userIdRef.current,
      user_agent: navigator.userAgent,
      locale: navigator.language
    }).then((session) => {
      setSessionId(session.id);
      sessionIdRef.current = session.id;
      telemetryRef.current = new TelemetryClient(session.id, userIdRef.current);
    });
  }, []);

  useEffect(() => {
    return () => {
      void telemetryRef.current?.flush();
      void endSession({ id: sessionIdRef.current, ended_at: Date.now() });
    };
  }, []);

  useEffect(() => {
    if (screen !== 'puzzle' || !puzzle) {
      return;
    }
    const telemetry = telemetryRef.current;
    if (!telemetry) {
      return;
    }

    void telemetry.emit({
      puzzle_id: puzzle.id,
      type: 'ui.puzzle_opened',
      payload_json: JSON.stringify({ puzzle_id: puzzle.id })
    });

    return () => {
      void telemetry.emit({
        puzzle_id: puzzle.id,
        type: 'ui.puzzle_closed',
        payload_json: JSON.stringify({ puzzle_id: puzzle.id })
      });
      void telemetry.flush();
    };
  }, [screen, puzzle]);

  useEffect(() => {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ completed }));
  }, [completed]);

  const unlockedMax = completed.length > 0 ? Math.min(17, Math.max(...completed) + 1) : 1;
  const groupedBlocks = useMemo(() => {
    return [...(puzzle?.availableBlocks ?? [])].sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
  }, [puzzle]);

  const worldPosition = useMemo(() => {
    if (!puzzle) {
      return { x: 0, y: 0 };
    }
    return runResult?.finalWorld
      ? { x: runResult.finalWorld.x, y: runResult.finalWorld.y }
      : { x: puzzle.grid.start.x, y: puzzle.grid.start.y };
  }, [puzzle, runResult]);

  function resetProgram(): void {
    setConnectedBlocks([]);
    setDisconnectedBlocks([]);
    setRunResult(null);
    setActiveBlockId(null);
    const telemetry = telemetryRef.current;
    if (telemetry && puzzle) {
      void telemetry.emit({
        attempt_id: attemptId ?? undefined,
        puzzle_id: puzzle.id,
        type: 'ui.reset_clicked',
        payload_json: JSON.stringify({ puzzle_id: puzzle.id })
      });
    }
  }

  function addBlockFromLibrary(block: AvailableBlock, target: 'connected' | 'disconnected' = 'connected'): void {
    const next: ProgramBlock = {
      id: createId('blk'),
      type: block.type,
      label: block.label,
      params: {
        ...(block.defaultParams ?? {}),
        ...(block.type === 'pickup' || block.type === 'treat' ? { item: 'medicine' } : {}),
        ...(block.type === 'repeat' ? { targetBlockId: '' } : {})
      },
      connected: target === 'connected'
    };
    if (target === 'connected') {
      setConnectedBlocks((prev) => [...prev, next]);
    } else {
      setDisconnectedBlocks((prev) => [...prev, next]);
    }

    const telemetry = telemetryRef.current;
    if (telemetry && puzzle) {
      void telemetry.emit({
        attempt_id: attemptId ?? undefined,
        puzzle_id: puzzle.id,
        type: 'ui.block_added',
        payload_json: JSON.stringify({ block_type: block.type, target })
      });
    }
  }

  function removeBlock(block: ProgramBlock): void {
    if (block.connected) {
      setConnectedBlocks((prev) => prev.filter((b) => b.id !== block.id));
    } else {
      setDisconnectedBlocks((prev) => prev.filter((b) => b.id !== block.id));
    }
    const telemetry = telemetryRef.current;
    if (telemetry && puzzle) {
      void telemetry.emit({
        attempt_id: attemptId ?? undefined,
        puzzle_id: puzzle.id,
        type: 'ui.block_removed',
        payload_json: JSON.stringify({ block_id: block.id, block_type: block.type })
      });
    }
  }

  function moveBlock(index: number, direction: 'up' | 'down'): void {
    setConnectedBlocks((prev) => {
      const next = [...prev];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) {
        return prev;
      }
      const current = next[index];
      next[index] = next[swapIndex];
      next[swapIndex] = current;
      return next;
    });
    const telemetry = telemetryRef.current;
    if (telemetry && puzzle) {
      void telemetry.emit({
        attempt_id: attemptId ?? undefined,
        puzzle_id: puzzle.id,
        type: 'ui.block_reordered',
        payload_json: JSON.stringify({ index, direction })
      });
    }
  }

  function updateParam(blockId: string, key: string, value: string | number, connected: boolean): void {
    const updater = (prev: ProgramBlock[]) => prev.map((b) => (b.id === blockId ? { ...b, params: { ...b.params, [key]: value } } : b));
    if (connected) {
      setConnectedBlocks(updater);
    } else {
      setDisconnectedBlocks(updater);
    }
    const telemetry = telemetryRef.current;
    if (telemetry && puzzle) {
      void telemetry.emit({
        attempt_id: attemptId ?? undefined,
        puzzle_id: puzzle.id,
        type: 'ui.block_parameter_changed',
        payload_json: JSON.stringify({ block_id: blockId, key, value })
      });
    }
  }

  function moveToDisconnected(block: ProgramBlock): void {
    setConnectedBlocks((prev) => prev.filter((b) => b.id !== block.id));
    setDisconnectedBlocks((prev) => [...prev, { ...block, connected: false }]);
    const telemetry = telemetryRef.current;
    if (telemetry && puzzle) {
      void telemetry.emit({
        attempt_id: attemptId ?? undefined,
        puzzle_id: puzzle.id,
        type: 'ui.block_removed',
        payload_json: JSON.stringify({ block_id: block.id, block_type: block.type, source: 'connected' })
      });
      void telemetry.emit({
        attempt_id: attemptId ?? undefined,
        puzzle_id: puzzle.id,
        type: 'ui.block_added',
        payload_json: JSON.stringify({ block_type: block.type, target: 'disconnected', block_id: block.id })
      });
    }
  }

  function moveToConnected(block: ProgramBlock): void {
    setDisconnectedBlocks((prev) => prev.filter((b) => b.id !== block.id));
    setConnectedBlocks((prev) => [...prev, { ...block, connected: true }]);
    const telemetry = telemetryRef.current;
    if (telemetry && puzzle) {
      void telemetry.emit({
        attempt_id: attemptId ?? undefined,
        puzzle_id: puzzle.id,
        type: 'ui.block_removed',
        payload_json: JSON.stringify({ block_id: block.id, block_type: block.type, source: 'disconnected' })
      });
      void telemetry.emit({
        attempt_id: attemptId ?? undefined,
        puzzle_id: puzzle.id,
        type: 'ui.block_added',
        payload_json: JSON.stringify({ block_type: block.type, target: 'connected', block_id: block.id })
      });
    }
  }

  async function playProgram(): Promise<void> {
    if (!puzzle || running) {
      return;
    }

    const currentAttemptId = createId('attempt');
    setAttemptId(currentAttemptId);
    setRunning(true);
    setRunResult(null);

    const telemetry = telemetryRef.current;
    if (telemetry) {
      await telemetry.emit({
        attempt_id: currentAttemptId,
        puzzle_id: puzzle.id,
        type: 'ui.play_clicked',
        payload_json: JSON.stringify({ puzzle_id: puzzle.id })
      });
      await telemetry.emit({
        attempt_id: currentAttemptId,
        puzzle_id: puzzle.id,
        type: 'run.started',
        payload_json: JSON.stringify({
          code_snapshot_json: JSON.stringify({ connectedBlocks, disconnectedBlocks }),
          block_count: connectedBlocks.length,
          client_version: CLIENT_VERSION
        })
      });
    }

    const speedDelay = speed === 'slow' ? 220 : speed === 'normal' ? 140 : 70;

    const result = await runProgram(puzzle, connectedBlocks, {
      onBlockStart: async (block) => {
        setActiveBlockId(block.id);
        await telemetry?.emit({
          attempt_id: currentAttemptId,
          puzzle_id: puzzle.id,
          type: 'exec.block_started',
          payload_json: JSON.stringify({ block_id: block.id, type: block.type })
        });
        await sleep(speedDelay);
      },
      onBlockFinish: async (block) => {
        await telemetry?.emit({
          attempt_id: currentAttemptId,
          puzzle_id: puzzle.id,
          type: 'exec.block_finished',
          payload_json: JSON.stringify({ block_id: block.id, type: block.type })
        });
      },
      onMove: async (movement) => {
        await telemetry?.emit({
          attempt_id: currentAttemptId,
          puzzle_id: puzzle.id,
          type: 'move.step',
          payload_json: JSON.stringify(movement)
        });
      },
      onTurn: async (direction) => {
        await telemetry?.emit({
          attempt_id: currentAttemptId,
          puzzle_id: puzzle.id,
          type: 'move.turn',
          payload_json: JSON.stringify({ direction })
        });
      },
      onPickup: async (item) => {
        await telemetry?.emit({
          attempt_id: currentAttemptId,
          puzzle_id: puzzle.id,
          type: 'world.pickup',
          payload_json: JSON.stringify({ item })
        });
      },
      onTreat: async (item) => {
        await telemetry?.emit({
          attempt_id: currentAttemptId,
          puzzle_id: puzzle.id,
          type: 'world.treat_applied',
          payload_json: JSON.stringify({ item })
        });
      },
      onCollision: async (x, y) => {
        await telemetry?.emit({
          attempt_id: currentAttemptId,
          puzzle_id: puzzle.id,
          type: 'world.collision',
          payload_json: JSON.stringify({ x, y })
        });
      }
    });

    setActiveBlockId(null);
    setRunResult(result);
    setRunning(false);

    if (telemetry) {
      await telemetry.emit({
        attempt_id: currentAttemptId,
        puzzle_id: puzzle.id,
        type: 'run.ended',
        payload_json: JSON.stringify({
          result: result.success ? 'success' : 'failure',
          failure_reason: result.failureReason ?? null,
          execution_steps: result.executionSteps,
          code_snapshot_json: JSON.stringify({ connectedBlocks, disconnectedBlocks }),
          block_count: connectedBlocks.length,
          client_version: CLIENT_VERSION
        })
      });
    }

    if (!result.success && telemetry) {
      await telemetry.emit({
        attempt_id: currentAttemptId,
        puzzle_id: puzzle.id,
        type: 'ui.hint_shown',
        payload_json: JSON.stringify({ reason: result.failureReason, hint_id: result.failureReason, hint: result.hint })
      });
    }

    if (result.success) {
      setCompleted((prev) => {
        if (prev.includes(puzzle.id)) {
          return prev;
        }
        return [...prev, puzzle.id].sort((a, b) => a - b);
      });
      if (telemetry) {
        await telemetry.emit({
          attempt_id: currentAttemptId,
          puzzle_id: puzzle.id,
          type: 'puzzle.completed',
          payload_json: JSON.stringify({ puzzle_id: puzzle.id })
        });
      }
    }
  }

  function speakGoal(): void {
    if (!puzzle || !window.speechSynthesis) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(puzzle.goalText);
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  const progressPercent = Math.round((completed.length / 17) * 100);

  if (screen === 'landing') {
    return (
      <main className="screen landing-screen">
        <section className="landing-card">
          <h1>Pet Vet Coding Puzzles</h1>
          <p>Help Dr. Poppy care for pets by building block programs with sequence, loops, and conditionals.</p>
          <div className="landing-actions">
            <button className="btn btn-primary" onClick={() => setScreen('levels')}>
              Start
            </button>
            <button className="btn" onClick={() => alert('Drag blocks under On Start, then press Play to run your program.')}>How to Play</button>
            {completed.length > 0 ? (
              <button className="btn" onClick={() => setScreen('levels')}>Continue</button>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  if (screen === 'levels') {
    return (
      <main className="screen level-screen">
        <header className="top-banner">
          <h2>Choose a Puzzle</h2>
          <p>{completed.length} of 17 completed</p>
        </header>
        <section className="level-grid" aria-label="Level select">
          {levels.map((level) => {
            const unlocked = level.id <= unlockedMax;
            const done = completed.includes(level.id);
            return (
              <button
                key={level.id}
                className={`level-node ${done ? 'done' : ''}`}
                disabled={!unlocked}
                onClick={() => {
                  setSelectedPuzzleId(level.id);
                  setConnectedBlocks([]);
                  setDisconnectedBlocks([]);
                  setRunResult(null);
                  setScreen('puzzle');
                }}
              >
                <span className="node-index">{level.id}</span>
                <span className="node-title">{level.title}</span>
                <span className="node-status">{done ? 'Completed' : unlocked ? 'Open' : 'Locked'}</span>
              </button>
            );
          })}
        </section>
      </main>
    );
  }

  return (
    <main className="screen puzzle-screen">
      <header className="puzzle-topbar">
        <div>
          <h2>Pet Vet Coding Puzzles</h2>
          <p>Puzzle {puzzle.id} of 17</p>
        </div>
        <div className="progress-wrap" role="status" aria-live="polite">
          <span>{progressPercent}% Complete</span>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progressPercent}%` }} /></div>
        </div>
        <div className="top-controls">
          <button className="btn" onClick={() => setSoundOn((v) => !v)}>{soundOn ? 'Sound On' : 'Sound Off'}</button>
          <button className="btn" onClick={() => setTtsEnabled((v) => !v)}>{ttsEnabled ? 'TTS Ready' : 'TTS Off'}</button>
          <button className="btn" onClick={() => setScreen('levels')}>Settings</button>
        </div>
      </header>

      <section className="scene-panel">
        <article>
          <h3>{puzzle.title}</h3>
          <p>{puzzle.storyText}</p>
        </article>
        <aside className="goal-banner">
          <p><strong>Goal:</strong> {puzzle.goalText}</p>
          <button className="btn" onClick={speakGoal} disabled={!ttsEnabled}>Read Goal</button>
        </aside>
        <div className="grid-scene" aria-label="Puzzle scene">
          {Array.from({ length: puzzle.grid.height }).map((_, y) => (
            <div key={y} className="grid-row">
              {Array.from({ length: puzzle.grid.width }).map((__, x) => {
                const obstacle = puzzle.grid.obstacles.some((o) => o.x === x && o.y === y);
                const pet = puzzle.grid.petTarget.x === x && puzzle.grid.petTarget.y === y;
                const item = puzzle.grid.itemTarget?.x === x && puzzle.grid.itemTarget?.y === y;
                const station = puzzle.grid.treatmentStation?.x === x && puzzle.grid.treatmentStation?.y === y;
                const player = worldPosition.x === x && worldPosition.y === y;
                return (
                  <div key={`${x}_${y}`} className={`tile ${obstacle ? 'tile-obstacle' : ''}`}>
                    {pet ? <span className="entity pet">Pet</span> : null}
                    {item ? <span className="entity item">Item</span> : null}
                    {station ? <span className="entity station">Station</span> : null}
                    {player ? <span className="entity player">You</span> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="workspace">
        <aside className="library" aria-label="Command library">
          <h3>Command Library</h3>
          {groupedBlocks.map((block) => (
            <div
              key={`${block.category}_${block.type}`}
              className="library-block"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/x-block-type', block.type);
              }}
            >
              <span>{block.category}</span>
              <strong>{block.label}</strong>
              <div className="library-actions">
                <button className="btn btn-small" onClick={() => addBlockFromLibrary(block, 'connected')}>Add</button>
                <button className="btn btn-small" onClick={() => addBlockFromLibrary(block, 'disconnected')}>Park</button>
              </div>
            </div>
          ))}
        </aside>

        <div className="program-area">
          <div className="program-head">
            <h3>Program</h3>
            <button className="btn" onClick={() => setShowCode((v) => !v)}>{showCode ? 'Hide Code' : 'Show Code'}</button>
          </div>
          <div className="on-start">On Start</div>
          <div
            className="connected-list"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const type = event.dataTransfer.getData('application/x-block-type');
              const source = groupedBlocks.find((b) => b.type === type);
              if (source) {
                addBlockFromLibrary(source, 'connected');
              }
            }}
          >
            {connectedBlocks.length === 0 ? <p className="empty-copy">Drop blocks here in a connected sequence.</p> : null}
            {connectedBlocks.map((block, index) => (
              <div
                key={block.id}
                className={`program-block ${activeBlockId === block.id ? 'running' : ''} ${runResult?.firstIncorrectBlockId === block.id ? 'error' : ''}`}
              >
                <span>{block.label}</span>
                {(block.type === 'repeat' || block.type === 'ifSymptom' || block.type === 'checkSymptom' || block.type === 'pickup' || block.type === 'treat') ? (
                  <div className="param-controls">
                    {block.type === 'repeat' ? (
                      <>
                        <label>
                          count
                          <input
                            type="number"
                            min={1}
                            max={16}
                            value={String(block.params.count ?? 2)}
                            onChange={(event) => updateParam(block.id, 'count', Number(event.target.value), true)}
                          />
                        </label>
                        <label>
                          target
                          <select
                            value={String(block.params.targetBlockId ?? '')}
                            onChange={(event) => updateParam(block.id, 'targetBlockId', event.target.value, true)}
                          >
                            <option value="">select block</option>
                            {connectedBlocks
                              .filter((candidate) => candidate.id !== block.id && candidate.type !== 'repeat')
                              .map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>{candidate.type}</option>
                              ))}
                          </select>
                        </label>
                      </>
                    ) : null}
                    {(block.type === 'ifSymptom' || block.type === 'checkSymptom') ? (
                      <label>
                        symptom
                        <select
                          value={String(block.params.symptom ?? 'sniffles')}
                          onChange={(event) => updateParam(block.id, 'symptom', event.target.value as Symptom, true)}
                        >
                          <option value="sniffles">sniffles</option>
                          <option value="injured">injured</option>
                          <option value="itchy">itchy</option>
                        </select>
                      </label>
                    ) : null}
                    {(block.type === 'pickup' || block.type === 'treat') ? (
                      <label>
                        item
                        <select
                          value={String(block.params.item ?? 'medicine')}
                          onChange={(event) => updateParam(block.id, 'item', event.target.value, true)}
                        >
                          <option value="medicine">medicine</option>
                          <option value="bandage">bandage</option>
                        </select>
                      </label>
                    ) : null}
                  </div>
                ) : null}
                <div className="program-actions">
                  <button className="btn btn-small" onClick={() => moveBlock(index, 'up')}>Up</button>
                  <button className="btn btn-small" onClick={() => moveBlock(index, 'down')}>Down</button>
                  <button className="btn btn-small" onClick={() => moveToDisconnected(block)}>Detach</button>
                  <button className="btn btn-small" onClick={() => removeBlock(block)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div
            className="disconnected-list"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const type = event.dataTransfer.getData('application/x-block-type');
              const source = groupedBlocks.find((b) => b.type === type);
              if (source) {
                addBlockFromLibrary(source, 'disconnected');
              }
            }}
          >
            <h4>Disconnected Blocks</h4>
            {disconnectedBlocks.length > 0 ? <p className="warning">Disconnected blocks will not run.</p> : <p className="empty-copy">No disconnected blocks.</p>}
            {disconnectedBlocks.map((block) => (
              <div key={block.id} className="program-block disconnected">
                <span>{block.label}</span>
                <div className="program-actions">
                  <button className="btn btn-small" onClick={() => moveToConnected(block)}>Connect</button>
                  <button className="btn btn-small" onClick={() => removeBlock(block)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          {showCode ? (
            <pre className="code-view" aria-label="Code view">{toCode(connectedBlocks)}</pre>
          ) : null}

          <div className="run-controls">
            <button className="btn btn-primary" onClick={() => void playProgram()} disabled={running}>Play</button>
            <button className="btn" onClick={resetProgram}>Reset</button>
            <button className="btn" onClick={() => void playProgram()} disabled={running}>Step</button>
            <label>
              Speed
              <select value={speed} onChange={(event) => setSpeed(event.target.value as 'slow' | 'normal' | 'fast')}>
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </label>
          </div>

          {runResult ? (
            <section className={`result ${runResult.success ? 'success' : 'failure'}`} role="status" aria-live="polite">
              {runResult.success ? (
                <>
                  <h4>Great job!</h4>
                  <p>{runResult.hint}</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (puzzle.id < 17) {
                        setSelectedPuzzleId(puzzle.id + 1);
                        resetProgram();
                      } else {
                        setScreen('levels');
                      }
                    }}
                  >
                    Next Puzzle
                  </button>
                </>
              ) : (
                <>
                  <h4>Oops!</h4>
                  <p>{runResult.hint}</p>
                  <p>Failure: {runResult.failureReason}</p>
                </>
              )}
            </section>
          ) : null}
        </div>
      </section>

      <footer className="footer-line">Session: {sessionId}</footer>
    </main>
  );
}
