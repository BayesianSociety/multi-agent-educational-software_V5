import type { FailureReason, Facing, ProgramBlock, PuzzleDefinition, RuntimeResult, RuntimeWorld, Symptom } from '../types';

const MAX_LOOP_ITERATIONS = 16;

function turnLeft(facing: Facing): Facing {
  switch (facing) {
    case 'N':
      return 'W';
    case 'W':
      return 'S';
    case 'S':
      return 'E';
    case 'E':
      return 'N';
  }
}

function turnRight(facing: Facing): Facing {
  switch (facing) {
    case 'N':
      return 'E';
    case 'E':
      return 'S';
    case 'S':
      return 'W';
    case 'W':
      return 'N';
  }
}

function movementDelta(facing: Facing): { dx: number; dy: number } {
  switch (facing) {
    case 'N':
      return { dx: 0, dy: -1 };
    case 'E':
      return { dx: 1, dy: 0 };
    case 'S':
      return { dx: 0, dy: 1 };
    case 'W':
      return { dx: -1, dy: 0 };
  }
}

function isObstacle(puzzle: PuzzleDefinition, x: number, y: number): boolean {
  return puzzle.grid.obstacles.some((o) => o.x === x && o.y === y);
}

function getHint(puzzle: PuzzleDefinition, reason: FailureReason): string {
  return puzzle.hintRules.find((h) => h.reason === reason)?.hint ?? 'Try another sequence.';
}

function desiredTreatmentFromSymptoms(symptoms: RuntimeWorld['symptoms']): 'medicine' | 'bandage' {
  if (symptoms.injured) {
    return 'bandage';
  }
  return 'medicine';
}

export interface RuntimeHooks {
  onBlockStart?: (block: ProgramBlock) => Promise<void>;
  onBlockFinish?: (block: ProgramBlock) => Promise<void>;
  onMove?: (movement: RuntimeResult['movements'][number]) => Promise<void>;
  onTurn?: (direction: Facing) => Promise<void>;
  onPickup?: (item: 'medicine' | 'bandage') => Promise<void>;
  onTreat?: (item: 'medicine' | 'bandage') => Promise<void>;
  onCollision?: (x: number, y: number) => Promise<void>;
}

export async function runProgram(
  puzzle: PuzzleDefinition,
  connectedBlocks: ProgramBlock[],
  hooks: RuntimeHooks = {}
): Promise<RuntimeResult> {
  const world: RuntimeWorld = {
    x: puzzle.grid.start.x,
    y: puzzle.grid.start.y,
    facing: puzzle.grid.start.facing,
    inventory: [],
    treated: [],
    animationState: 'idle',
    symptoms: { ...puzzle.entities.petSymptoms }
  };

  const movements: RuntimeResult['movements'] = [];
  let executionSteps = 0;
  let wrongBlockId: string | undefined;
  let failureReason: FailureReason | undefined;

  const executeBlock = async (block: ProgramBlock): Promise<void> => {
    executionSteps += 1;
    await hooks.onBlockStart?.(block);

    if (block.type === 'walk') {
      const { dx, dy } = movementDelta(world.facing);
      const nextX = world.x + dx;
      const nextY = world.y + dy;
      const outOfBounds = nextX < 0 || nextY < 0 || nextX >= puzzle.grid.width || nextY >= puzzle.grid.height;
      const blocked = outOfBounds || isObstacle(puzzle, nextX, nextY);
      const movement = {
        fromX: world.x,
        fromY: world.y,
        toX: blocked ? world.x : nextX,
        toY: blocked ? world.y : nextY,
        direction: world.facing,
        cause: 'walk',
        blocked
      };
      movements.push(movement);
      await hooks.onMove?.(movement);

      if (blocked) {
        await hooks.onCollision?.(nextX, nextY);
        failureReason = 'obstacle_collision';
        wrongBlockId = block.id;
      } else {
        world.x = nextX;
        world.y = nextY;
      }
    }

    if (block.type === 'turnLeft') {
      world.facing = turnLeft(world.facing);
      await hooks.onTurn?.(world.facing);
    }

    if (block.type === 'turnRight') {
      world.facing = turnRight(world.facing);
      await hooks.onTurn?.(world.facing);
    }

    if (block.type === 'pickup') {
      const itemType = (block.params.item as 'medicine' | 'bandage') ?? puzzle.grid.itemTarget?.item ?? 'medicine';
      if (!puzzle.grid.itemTarget || world.x !== puzzle.grid.itemTarget.x || world.y !== puzzle.grid.itemTarget.y) {
        failureReason = 'wrong_order';
        wrongBlockId = block.id;
      } else {
        world.inventory.push(itemType);
        await hooks.onPickup?.(itemType);
      }
    }

    if (block.type === 'treat') {
      const expectedItem = desiredTreatmentFromSymptoms(world.symptoms);
      const itemType = (block.params.item as 'medicine' | 'bandage') ?? expectedItem;
      const atStation = !puzzle.grid.treatmentStation ||
        (world.x === puzzle.grid.treatmentStation.x && world.y === puzzle.grid.treatmentStation.y);

      if (!atStation) {
        failureReason = 'target_not_reached';
        wrongBlockId = block.id;
      } else if (!world.inventory.includes(itemType)) {
        failureReason = 'wrong_item_used';
        wrongBlockId = block.id;
      } else if (itemType !== expectedItem) {
        failureReason = 'condition_not_handled';
        wrongBlockId = block.id;
      } else {
        world.treated.push(itemType);
        await hooks.onTreat?.(itemType);
      }
    }

    if (block.type === 'ifSymptom') {
      const symptom = (block.params.symptom as Symptom | undefined) ?? 'sniffles';
      const expectedItem = desiredTreatmentFromSymptoms(world.symptoms);
      if (!world.symptoms[symptom]) {
        if (puzzle.constraints.requiresConditional) {
          failureReason = 'condition_not_handled';
          wrongBlockId = block.id;
        }
      } else {
        const available = world.inventory.includes(expectedItem);
        if (!available && puzzle.constraints.requiresPickup) {
          failureReason = 'wrong_item_used';
          wrongBlockId = block.id;
        }
      }
    }

    await hooks.onBlockFinish?.(block);
  };

  for (const block of connectedBlocks) {
    if (failureReason) {
      break;
    }

    if (block.type === 'repeat') {
      executionSteps += 1;
      await hooks.onBlockStart?.(block);
      const count = Number(block.params.count ?? 2);
      if (count > MAX_LOOP_ITERATIONS) {
        failureReason = 'runtime_safety_cap';
        wrongBlockId = block.id;
        await hooks.onBlockFinish?.(block);
        break;
      }
      const loopTarget = connectedBlocks.find((candidate) => candidate.id === String(block.params.targetBlockId));
      if (!loopTarget) {
        failureReason = 'wrong_order';
        wrongBlockId = block.id;
        await hooks.onBlockFinish?.(block);
        break;
      }
      for (let i = 0; i < count; i += 1) {
        if (failureReason) {
          break;
        }
        await executeBlock(loopTarget);
      }
      await hooks.onBlockFinish?.(block);
      continue;
    }

    if (block.type === 'checkSymptom') {
      executionSteps += 1;
      await hooks.onBlockStart?.(block);
      await hooks.onBlockFinish?.(block);
      continue;
    }

    await executeBlock(block);
  }

  const reachedPet = world.x === puzzle.grid.petTarget.x && world.y === puzzle.grid.petTarget.y;
  const treatmentNeeded = Boolean(puzzle.grid.treatmentStation);
  const treatedItem = puzzle.grid.treatmentStation?.treatment;
  const treatedCorrectly = !treatmentNeeded || (treatedItem ? world.treated.includes(treatedItem) : false);

  if (!failureReason && !reachedPet) {
    failureReason = 'target_not_reached';
  }

  if (!failureReason && treatmentNeeded && !treatedCorrectly) {
    failureReason = 'wrong_order';
  }

  return {
    success: !failureReason,
    failureReason,
    hint: failureReason ? getHint(puzzle, failureReason) : 'Great work! Ready for the next puzzle.',
    executionSteps,
    firstIncorrectBlockId: wrongBlockId,
    movements,
    finalWorld: world
  };
}
