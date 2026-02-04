import { Point, PhysicsAnalysis, Force } from "../types";

type Frame = { data: string; timestamp: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeTimestamps = (frames: Frame[]) => {
  const times = frames.map((f, i) =>
    Number.isFinite(f.timestamp) ? f.timestamp : i * 0.1
  );
  for (let i = 1; i < times.length; i++) {
    if (times[i] <= times[i - 1]) {
      times[i] = times[i - 1] + 0.1;
    }
  }
  return times;
};

const buildPath = (frames: Frame[]): Point[] => {
  const timestamps = normalizeTimestamps(frames);
  const lastIdx = Math.max(1, frames.length - 1);

  return frames.map((_, i) => {
    const t = i / lastIdx;
    const x = 10 + 80 * t;
    const y = 70 - 40 * Math.sin(Math.PI * t);
    const angle = -12 + 24 * Math.sin(t * Math.PI * 2);

    return {
      x: clamp(x, 0, 100),
      y: clamp(y, 0, 100),
      angle,
      timestamp: timestamps[i],
    };
  });
};

const defaultForces: Force[] = [
  { name: "Gravity", magnitude: 9.8, direction: 270, color: "#f87171" },
  { name: "Normal Force", magnitude: 9.8, direction: 90, color: "#10b981" },
  { name: "Friction", magnitude: 3.2, direction: 180, color: "#fbbf24" },
  { name: "Applied", magnitude: 5.5, direction: 0, color: "#60a5fa" },
];

const estimateVelocity = (path: Point[]) => {
  if (path.length < 2) return 0;
  const first = path[0];
  const last = path[path.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const dt = Math.max(0.001, last.timestamp - first.timestamp);
  return Math.sqrt(dx * dx + dy * dy) / dt;
};

const estimateAcceleration = (path: Point[]) => {
  if (path.length < 3) return 0;
  const v1 = estimateVelocity(path.slice(0, Math.ceil(path.length / 2)));
  const v2 = estimateVelocity(path.slice(Math.floor(path.length / 2)));
  const dt =
    path[path.length - 1].timestamp - path[Math.floor(path.length / 2)].timestamp;
  return dt > 0 ? (v2 - v1) / dt : 0;
};

export async function analyzeMotion(frames: Frame[]): Promise<PhysicsAnalysis> {
  if (!frames || frames.length < 3) {
    throw new Error("Capture sequence too brief.");
  }

  const path = buildPath(frames);
  const calculatedVelocity = estimateVelocity(path);
  const calculatedAcceleration = estimateAcceleration(path);

  return {
    objectName: "Tracked Object",
    path,
    forces: defaultForces,
    summary:
      "Offline analysis generated a smooth motion path and standard force model based on capture timing.",
    calculatedVelocity,
    calculatedAcceleration,
  };
}
