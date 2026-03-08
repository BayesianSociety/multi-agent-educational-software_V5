import { describe, expect, it } from 'vitest';
import { getPuzzleById } from '../data/puzzles';
import { runProgram } from './engine';
import type { ProgramBlock } from '../types';

function block(id: string, type: ProgramBlock['type'], params: Record<string, string | number> = {}): ProgramBlock {
  return { id, type, label: type, params, connected: true };
}

describe('runtime engine', () => {
  it('fails with obstacle collision deterministically', async () => {
    const puzzle = getPuzzleById(3);
    expect(puzzle).toBeTruthy();

    const result = await runProgram(
      puzzle!,
      [block('a', 'walk'), block('b', 'walk'), block('c', 'walk')]
    );

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('obstacle_collision');
    expect(result.movements.some((m) => m.blocked)).toBe(true);
  });

  it('respects loop iteration cap', async () => {
    const puzzle = getPuzzleById(6);
    expect(puzzle).toBeTruthy();

    const result = await runProgram(
      puzzle!,
      [
        block('w', 'walk'),
        block('r', 'repeat', { count: 99, targetBlockId: 'w' })
      ]
    );

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('runtime_safety_cap');
  });

  it('walk advances exactly one tile and turn updates facing deterministically', async () => {
    const puzzle = getPuzzleById(1);
    expect(puzzle).toBeTruthy();

    const result = await runProgram(
      puzzle!,
      [block('turn', 'turnRight'), block('step', 'walk')]
    );

    expect(result.finalWorld.x).toBe(0);
    expect(result.finalWorld.y).toBe(1);
    expect(result.finalWorld.facing).toBe('S');
  });

  it('fails with wrong_item_used when treat item was not picked up', async () => {
    const puzzle = getPuzzleById(11);
    expect(puzzle).toBeTruthy();

    const result = await runProgram(
      puzzle!,
      [block('move1', 'walk'), block('move2', 'walk'), block('move3', 'walk'), block('treat', 'treat', { item: 'medicine' })]
    );

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('wrong_item_used');
  });
});
