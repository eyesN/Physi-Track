export type EdgeDetectionConfig = {
  edgeThreshold: number;
  motionThreshold: number;
  minEdgeCount: number;
};

export type EdgeBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type EdgeDetectionOutput = {
  gray: Float32Array;
  center: { x: number; y: number } | null;
  bounds: EdgeBounds | null;
  edgeCount: number;
};

export type FbdArrow = {
  label: string;
  color: string;
  vec: { x: number; y: number };
  length: number;
  dashed?: boolean;
};

export type FbdOverlayOptions = {
  rotation?: number;
  boxSize?: { width: number; height: number };
  boxFill?: string;
  boxStroke?: string;
  labelFont?: string;
  labelOffset?: number;
};

const DEFAULT_OVERLAY_OPTIONS: Required<FbdOverlayOptions> = {
  rotation: 0,
  boxSize: { width: 34, height: 22 },
  boxFill: 'rgba(226, 232, 240, 0.92)',
  boxStroke: 'rgba(148, 163, 184, 0.9)',
  labelFont: '11px "Space Grotesk", "Segoe UI", sans-serif',
  labelOffset: 12,
};

const drawArrow = (
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  dashed: boolean
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.setLineDash(dashed ? [6, 4] : []);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLength = 8;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

export const detectEdgesAndCenter = (
  frame: ImageData,
  prevGray: Float32Array | null,
  config: EdgeDetectionConfig
): EdgeDetectionOutput => {
  const { data, width, height } = frame;
  const gray = new Float32Array(width * height);

  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[j] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const hasPrev = !!prevGray && prevGray.length === gray.length;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  let edgeCount = 0;

  const { edgeThreshold, motionThreshold, minEdgeCount } = config;

  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const idx = row + x;

      const g00 = gray[idx - width - 1];
      const g01 = gray[idx - width];
      const g02 = gray[idx - width + 1];
      const g10 = gray[idx - 1];
      const g12 = gray[idx + 1];
      const g20 = gray[idx + width - 1];
      const g21 = gray[idx + width];
      const g22 = gray[idx + width + 1];

      const gx = -g00 - 2 * g10 - g20 + g02 + 2 * g12 + g22;
      const gy = -g00 - 2 * g01 - g02 + g20 + 2 * g21 + g22;
      const magnitude = Math.abs(gx) + Math.abs(gy);

      if (magnitude < edgeThreshold) continue;

      if (hasPrev) {
        const diff = Math.abs(gray[idx] - prevGray![idx]);
        if (diff < motionThreshold) continue;
      }

      edgeCount += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (edgeCount < minEdgeCount) {
    return {
      gray,
      center: null,
      bounds: null,
      edgeCount,
    };
  }

  return {
    gray,
    center: { x: sumX / edgeCount, y: sumY / edgeCount },
    bounds: { minX, minY, maxX, maxY },
    edgeCount,
  };
};

export const drawFbdOverlay = (
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  arrows: FbdArrow[],
  options?: FbdOverlayOptions
) => {
  const settings = { ...DEFAULT_OVERLAY_OPTIONS, ...options };

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(settings.rotation);
  ctx.fillStyle = settings.boxFill;
  ctx.strokeStyle = settings.boxStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(
    -settings.boxSize.width / 2,
    -settings.boxSize.height / 2,
    settings.boxSize.width,
    settings.boxSize.height
  );
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.font = settings.labelFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  arrows.forEach((arrow) => {
    if (arrow.length <= 0) return;
    const endX = center.x + arrow.vec.x * arrow.length;
    const endY = center.y + arrow.vec.y * arrow.length;

    drawArrow(ctx, center, { x: endX, y: endY }, arrow.color, !!arrow.dashed);

    const labelX = center.x + arrow.vec.x * (arrow.length + settings.labelOffset);
    const labelY = center.y + arrow.vec.y * (arrow.length + settings.labelOffset);

    ctx.fillStyle = arrow.color;
    ctx.fillText(arrow.label, labelX, labelY);
  });
};
