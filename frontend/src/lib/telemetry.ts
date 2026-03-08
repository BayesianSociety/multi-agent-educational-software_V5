import { createId } from './id';
import { sendEventBatch } from './api';
import type { TelemetryEvent } from '../types';

const IMMEDIATE_TYPES = new Set([
  'run.started',
  'run.ended',
  'exec.block_started',
  'exec.block_finished',
  'move.step',
  'move.turn',
  'world.pickup',
  'world.treat_applied',
  'world.collision',
  'puzzle.completed'
]);

export class TelemetryClient {
  private queue: TelemetryEvent[] = [];
  private timer: number | undefined;

  constructor(
    private readonly sessionId: string,
    private readonly userId: string
  ) {}

  async emit(event: Omit<TelemetryEvent, 'id' | 'session_id' | 'user_id' | 'ts'> & { ts?: number }): Promise<void> {
    const built: TelemetryEvent = {
      id: createId('evt'),
      session_id: this.sessionId,
      user_id: this.userId,
      ts: event.ts ?? Date.now(),
      attempt_id: event.attempt_id,
      puzzle_id: event.puzzle_id,
      type: event.type,
      payload_json: event.payload_json
    };

    if (IMMEDIATE_TYPES.has(built.type)) {
      await sendEventBatch([built]);
      return;
    }

    this.queue.push(built);
    if (this.timer === undefined) {
      this.timer = window.setTimeout(() => {
        void this.flush();
      }, 350);
    }
  }

  async flush(): Promise<void> {
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.queue.length === 0) {
      return;
    }
    const batch = this.queue.splice(0, this.queue.length);
    await sendEventBatch(batch);
  }
}
