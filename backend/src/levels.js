const baseHints = [
  { reason: 'target_not_reached', hint: 'Guide your assistant closer to the pet before treating.' },
  { reason: 'wrong_item_used', hint: 'Choose the item that matches the pet symptom.' },
  { reason: 'wrong_order', hint: 'Try exam first, then pickup, then treatment.' },
  { reason: 'obstacle_collision', hint: 'Turn before walking to avoid blocked tiles.' },
  { reason: 'condition_not_handled', hint: 'Add a symptom check block for this puzzle.' },
  { reason: 'runtime_safety_cap', hint: 'Your loop repeated too long. Lower repeat count.' }
];

const movementBlocks = [
  { type: 'walk', category: 'Movement', label: 'walk()' },
  { type: 'turnLeft', category: 'Movement', label: 'turnLeft()' },
  { type: 'turnRight', category: 'Movement', label: 'turnRight()' }
];

const actionBlocks = [
  { type: 'pickup', category: 'Actions', label: 'pickup(item)' },
  { type: 'treat', category: 'Actions', label: 'treat(item)' }
];

const loopBlocks = [
  { type: 'repeat', category: 'Control', label: 'repeat(n)', defaultParams: { count: 2 } }
];

const logicBlocks = [
  { type: 'ifSymptom', category: 'Logic', label: 'ifSymptom(symptom)', defaultParams: { symptom: 'sniffles' } }
];

const sensingBlocks = [
  { type: 'checkSymptom', category: 'Sensing', label: 'checkSymptom(symptom)', defaultParams: { symptom: 'sniffles' } }
];

function puzzle(id, title, scene, goalText, config) {
  return {
    id,
    title,
    storyText: `Mentor Dr. Poppy asks you to help ${id % 2 === 0 ? 'Milo' : 'Luna'} in the ${scene.replace('_', ' ')}.`,
    goalText,
    scene,
    grid: {
      width: 6,
      height: 6,
      obstacles: config.obstacles,
      start: config.start,
      petTarget: config.petTarget,
      itemTarget: config.itemTarget,
      treatmentStation: config.station
    },
    entities: {
      mentorName: 'Dr. Poppy',
      petName: id % 2 === 0 ? 'Milo' : 'Luna',
      petSymptoms: config.symptoms
    },
    availableBlocks: config.blocks,
    constraints: {
      maxBlocks: config.maxBlocks,
      requiresPickup: config.requiresPickup,
      requiresConditional: config.requiresConditional,
      requiresLoop: config.requiresLoop
    },
    successCriteria: {
      reachPet: true,
      applyRequiredTreatment: Boolean(config.station),
      noCollision: true
    },
    hintRules: [...baseHints]
  };
}

export const LEVELS = [
  puzzle(1, 'Check-In Walk', 'waiting_area', 'Move to the pet waiting by the front chair.', {
    start: { x: 0, y: 0, facing: 'E' },
    petTarget: { x: 2, y: 0 },
    obstacles: [],
    symptoms: { itchy: false, sniffles: true, injured: false },
    blocks: [...movementBlocks],
    maxBlocks: 4,
    requiresPickup: false,
    requiresLoop: false,
    requiresConditional: false
  }),
  puzzle(2, 'Hallway Turn', 'hallway', 'Reach the pet at the corner bed.', {
    start: { x: 0, y: 0, facing: 'E' },
    petTarget: { x: 2, y: 1 },
    obstacles: [{ x: 3, y: 0 }],
    symptoms: { itchy: false, sniffles: true, injured: false },
    blocks: [...movementBlocks],
    maxBlocks: 6,
    requiresPickup: false,
    requiresLoop: false,
    requiresConditional: false
  }),
  puzzle(3, 'Exam Room Route', 'exam_room', 'Walk around the stool and reach the pet.', {
    start: { x: 0, y: 2, facing: 'E' },
    petTarget: { x: 3, y: 2 },
    obstacles: [{ x: 2, y: 2 }],
    symptoms: { itchy: false, sniffles: true, injured: false },
    blocks: [...movementBlocks],
    maxBlocks: 8,
    requiresPickup: false,
    requiresLoop: false,
    requiresConditional: false
  }),
  puzzle(4, 'Pick Medicine', 'treatment_corner', 'Pick up medicine, then reach the pet.', {
    start: { x: 0, y: 0, facing: 'E' },
    petTarget: { x: 3, y: 0 },
    itemTarget: { x: 1, y: 0, item: 'medicine' },
    obstacles: [],
    symptoms: { itchy: false, sniffles: true, injured: false },
    blocks: [...movementBlocks, ...actionBlocks],
    maxBlocks: 8,
    requiresPickup: true,
    requiresLoop: false,
    requiresConditional: false
  }),
  puzzle(5, 'Bandage Prep', 'exam_room', 'Pick up a bandage, then reach the injured pet.', {
    start: { x: 0, y: 1, facing: 'E' },
    petTarget: { x: 4, y: 1 },
    itemTarget: { x: 2, y: 1, item: 'bandage' },
    obstacles: [{ x: 3, y: 1 }],
    symptoms: { itchy: false, sniffles: false, injured: true },
    blocks: [...movementBlocks, ...actionBlocks],
    maxBlocks: 9,
    requiresPickup: true,
    requiresLoop: false,
    requiresConditional: false
  }),
  puzzle(6, 'Looped Steps', 'hallway', 'Use a loop to reach the pet quickly.', {
    start: { x: 0, y: 0, facing: 'E' },
    petTarget: { x: 4, y: 0 },
    obstacles: [],
    symptoms: { itchy: false, sniffles: true, injured: false },
    blocks: [...movementBlocks, ...loopBlocks],
    maxBlocks: 5,
    requiresPickup: false,
    requiresLoop: true,
    requiresConditional: false
  }),
  puzzle(7, 'Loop Around Crate', 'waiting_area', 'Loop movement to reach the pet near the crate.', {
    start: { x: 0, y: 1, facing: 'E' },
    petTarget: { x: 4, y: 2 },
    obstacles: [{ x: 2, y: 1 }],
    symptoms: { itchy: true, sniffles: false, injured: false },
    blocks: [...movementBlocks, ...loopBlocks],
    maxBlocks: 8,
    requiresPickup: false,
    requiresLoop: true,
    requiresConditional: false
  }),
  puzzle(8, 'Loop Pickup', 'treatment_corner', 'Use repeat steps to pick medicine and reach station.', {
    start: { x: 0, y: 0, facing: 'E' },
    petTarget: { x: 4, y: 0 },
    itemTarget: { x: 2, y: 0, item: 'medicine' },
    station: { x: 4, y: 0, treatment: 'medicine' },
    obstacles: [],
    symptoms: { itchy: false, sniffles: true, injured: false },
    blocks: [...movementBlocks, ...loopBlocks, ...actionBlocks],
    maxBlocks: 9,
    requiresPickup: true,
    requiresLoop: true,
    requiresConditional: false
  }),
  puzzle(9, 'Hallway Delivery', 'hallway', 'Repeat moves, collect bandage, and treat.', {
    start: { x: 0, y: 3, facing: 'E' },
    petTarget: { x: 5, y: 3 },
    itemTarget: { x: 2, y: 3, item: 'bandage' },
    station: { x: 5, y: 3, treatment: 'bandage' },
    obstacles: [{ x: 4, y: 3 }],
    symptoms: { itchy: false, sniffles: false, injured: true },
    blocks: [...movementBlocks, ...loopBlocks, ...actionBlocks],
    maxBlocks: 10,
    requiresPickup: true,
    requiresLoop: true,
    requiresConditional: false
  }),
  puzzle(10, 'Busy Corner', 'exam_room', 'Use looped walking and turning without hitting tools.', {
    start: { x: 0, y: 0, facing: 'E' },
    petTarget: { x: 4, y: 2 },
    obstacles: [{ x: 2, y: 0 }, { x: 2, y: 1 }],
    symptoms: { itchy: true, sniffles: false, injured: false },
    blocks: [...movementBlocks, ...loopBlocks],
    maxBlocks: 9,
    requiresPickup: false,
    requiresLoop: true,
    requiresConditional: false
  }),
  puzzle(11, 'Check Sniffles', 'exam_room', 'Use a symptom condition before treatment.', {
    start: { x: 0, y: 1, facing: 'E' },
    petTarget: { x: 3, y: 1 },
    itemTarget: { x: 1, y: 1, item: 'medicine' },
    station: { x: 3, y: 1, treatment: 'medicine' },
    obstacles: [],
    symptoms: { itchy: false, sniffles: true, injured: false },
    blocks: [...movementBlocks, ...actionBlocks, ...logicBlocks, ...sensingBlocks],
    maxBlocks: 11,
    requiresPickup: true,
    requiresLoop: false,
    requiresConditional: true
  }),
  puzzle(12, 'Check Injury', 'treatment_corner', 'Conditionally apply a bandage in order.', {
    start: { x: 0, y: 0, facing: 'E' },
    petTarget: { x: 4, y: 0 },
    itemTarget: { x: 1, y: 0, item: 'bandage' },
    station: { x: 4, y: 0, treatment: 'bandage' },
    obstacles: [],
    symptoms: { itchy: false, sniffles: false, injured: true },
    blocks: [...movementBlocks, ...actionBlocks, ...logicBlocks],
    maxBlocks: 11,
    requiresPickup: true,
    requiresLoop: false,
    requiresConditional: true
  }),
  puzzle(13, 'Loop And Check', 'hallway', 'Use loop and condition to reach and treat correctly.', {
    start: { x: 0, y: 2, facing: 'E' },
    petTarget: { x: 5, y: 2 },
    itemTarget: { x: 2, y: 2, item: 'medicine' },
    station: { x: 5, y: 2, treatment: 'medicine' },
    obstacles: [{ x: 4, y: 2 }],
    symptoms: { itchy: false, sniffles: true, injured: false },
    blocks: [...movementBlocks, ...loopBlocks, ...actionBlocks, ...logicBlocks],
    maxBlocks: 12,
    requiresPickup: true,
    requiresLoop: true,
    requiresConditional: true
  }),
  puzzle(14, 'Dual Symptom Logic', 'exam_room', 'Check symptom and avoid collision while treating.', {
    start: { x: 0, y: 4, facing: 'E' },
    petTarget: { x: 4, y: 4 },
    itemTarget: { x: 1, y: 4, item: 'medicine' },
    station: { x: 4, y: 4, treatment: 'medicine' },
    obstacles: [{ x: 3, y: 4 }],
    symptoms: { itchy: true, sniffles: true, injured: false },
    blocks: [...movementBlocks, ...loopBlocks, ...actionBlocks, ...logicBlocks, ...sensingBlocks],
    maxBlocks: 12,
    requiresPickup: true,
    requiresLoop: true,
    requiresConditional: true
  }),
  puzzle(15, 'Itchy Care', 'waiting_area', 'Use conditionals to select treatment path.', {
    start: { x: 0, y: 3, facing: 'E' },
    petTarget: { x: 4, y: 3 },
    itemTarget: { x: 2, y: 3, item: 'medicine' },
    station: { x: 4, y: 3, treatment: 'medicine' },
    obstacles: [{ x: 1, y: 2 }],
    symptoms: { itchy: true, sniffles: false, injured: false },
    blocks: [...movementBlocks, ...loopBlocks, ...actionBlocks, ...logicBlocks],
    maxBlocks: 12,
    requiresPickup: true,
    requiresLoop: true,
    requiresConditional: true
  }),
  puzzle(16, 'Mixed Routine', 'treatment_corner', 'Combine repeat and symptom checks for safe treatment.', {
    start: { x: 0, y: 1, facing: 'E' },
    petTarget: { x: 5, y: 1 },
    itemTarget: { x: 2, y: 1, item: 'bandage' },
    station: { x: 5, y: 1, treatment: 'bandage' },
    obstacles: [{ x: 4, y: 1 }],
    symptoms: { itchy: false, sniffles: false, injured: true },
    blocks: [...movementBlocks, ...loopBlocks, ...actionBlocks, ...logicBlocks, ...sensingBlocks],
    maxBlocks: 13,
    requiresPickup: true,
    requiresLoop: true,
    requiresConditional: true
  }),
  puzzle(17, 'Clinic Finale', 'exam_room', 'Finish the full routine with loops and conditionals.', {
    start: { x: 0, y: 0, facing: 'E' },
    petTarget: { x: 5, y: 2 },
    itemTarget: { x: 1, y: 0, item: 'medicine' },
    station: { x: 5, y: 2, treatment: 'medicine' },
    obstacles: [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 2 }],
    symptoms: { itchy: true, sniffles: true, injured: false },
    blocks: [...movementBlocks, ...loopBlocks, ...actionBlocks, ...logicBlocks, ...sensingBlocks],
    maxBlocks: 14,
    requiresPickup: true,
    requiresLoop: true,
    requiresConditional: true
  })
];

export function getLevelById(id) {
  return LEVELS.find((level) => level.id === id);
}
