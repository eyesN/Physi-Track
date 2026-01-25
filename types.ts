
export interface Point {
  x: number;
  y: number;
  timestamp: number;
}

export interface Force {
  name: string;
  magnitude: number;
  direction: number; // Degrees, 0 is right, 90 is up
  color: string;
}

export interface PhysicsAnalysis {
  objectName: string;
  path: Point[];
  forces: Force[];
  summary: string;
  calculatedVelocity: number;
  calculatedAcceleration: number;
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS'
}
