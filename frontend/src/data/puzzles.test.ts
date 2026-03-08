import { describe, expect, it } from 'vitest';
import { PUZZLES } from './puzzles';

describe('puzzle data contract', () => {
  it('contains exactly 17 puzzles with required ids', () => {
    expect(PUZZLES).toHaveLength(17);
    expect(PUZZLES.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('includes all required fields for each puzzle', () => {
    for (const puzzle of PUZZLES) {
      expect(typeof puzzle.id).toBe('number');
      expect(typeof puzzle.title).toBe('string');
      expect(typeof puzzle.storyText).toBe('string');
      expect(typeof puzzle.goalText).toBe('string');
      expect(typeof puzzle.scene).toBe('string');
      expect(puzzle.grid).toBeTruthy();
      expect(puzzle.entities).toBeTruthy();
      expect(Array.isArray(puzzle.availableBlocks)).toBe(true);
      expect(puzzle.constraints).toBeTruthy();
      expect(puzzle.successCriteria).toBeTruthy();
      expect(Array.isArray(puzzle.hintRules)).toBe(true);
    }
  });

  it('matches progression constraints by puzzle range', () => {
    for (const puzzle of PUZZLES) {
      if (puzzle.id >= 1 && puzzle.id <= 5) {
        expect(puzzle.constraints.requiresConditional).toBe(false);
      }
      if (puzzle.id >= 6 && puzzle.id <= 10) {
        expect(puzzle.constraints.requiresLoop).toBe(true);
      }
      if (puzzle.id >= 11 && puzzle.id <= 17) {
        expect(puzzle.constraints.requiresConditional).toBe(true);
      }
    }
  });
});
