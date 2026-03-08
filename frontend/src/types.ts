export type Facing = 'N' | 'E' | 'S' | 'W';

export type FailureReason =
  | 'target_not_reached'
  | 'wrong_item_used'
  | 'wrong_order'
  | 'obstacle_collision'
  | 'condition_not_handled'
  | 'runtime_safety_cap';

export type BlockCategory = 'Movement' | 'Actions' | 'Control' | 'Logic' | 'Sensing';

export type BlockType =
  | 'walk'
  | 'turnLeft'
  | 'turnRight'
  | 'pickup'
  | 'treat'
  | 'repeat'
  | 'ifSymptom'
  | 'checkSymptom';

export type Symptom = 'itchy' | 'sniffles' | 'injured';

export interface AvailableBlock {
  type: BlockType;
  category: BlockCategory;
  label: string;
  defaultParams?: Record<string, string | number>;
}

export interface GridSpec {
  width: number;
  height: number;
  obstacles: Array<{ x: number; y: number }>;
  start: { x: number; y: number; facing: Facing };
  petTarget: { x: number; y: number };
  itemTarget?: { x: number; y: number; item: 'medicine' | 'bandage' };
  treatmentStation?: { x: number; y: number; treatment: 'medicine' | 'bandage' };
}

export interface EntitySpec {
  mentorName: string;
  petName: string;
  petSymptoms: {
    itchy: boolean;
    sniffles: boolean;
    injured: boolean;
  };
}

export interface PuzzleConstraints {
  maxBlocks: number;
  requiresPickup: boolean;
  requiresConditional: boolean;
  requiresLoop: boolean;
}

export interface SuccessCriteria {
  reachPet: boolean;
  applyRequiredTreatment: boolean;
  noCollision: boolean;
}

export interface HintRule {
  reason: FailureReason;
  hint: string;
}

export interface PuzzleDefinition {
  id: number;
  title: string;
  storyText: string;
  goalText: string;
  scene: 'waiting_area' | 'hallway' | 'exam_room' | 'treatment_corner';
  grid: GridSpec;
  entities: EntitySpec;
  availableBlocks: AvailableBlock[];
  constraints: PuzzleConstraints;
  successCriteria: SuccessCriteria;
  hintRules: HintRule[];
}

export interface ProgramBlock {
  id: string;
  type: BlockType;
  label: string;
  params: Record<string, string | number>;
  connected: boolean;
}

export interface RuntimeWorld {
  x: number;
  y: number;
  facing: Facing;
  inventory: Array<'medicine' | 'bandage'>;
  treated: Array<'medicine' | 'bandage'>;
  animationState: 'idle' | 'moving' | 'acting';
  symptoms: {
    itchy: boolean;
    sniffles: boolean;
    injured: boolean;
  };
}

export interface RuntimeResult {
  success: boolean;
  failureReason?: FailureReason;
  hint: string;
  executionSteps: number;
  firstIncorrectBlockId?: string;
  movements: Array<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    direction: Facing;
    cause: string;
    blocked: boolean;
  }>;
  finalWorld: RuntimeWorld;
}

export interface TelemetryEvent {
  id: string;
  session_id: string;
  user_id?: string;
  attempt_id?: string;
  puzzle_id?: number;
  ts: number;
  type: string;
  payload_json: string;
}
