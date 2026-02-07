export function computeFbdArrows({ mass, thetaDeg, mu, showComponents }) {
  const g = 9.81;
  const thetaRad = (thetaDeg * Math.PI) / 180;
  const weight = mass * g;
  const normal = weight * Math.cos(thetaRad);
  const weightParallel = weight * Math.sin(thetaRad);
  const friction = mu * normal;

  const weightLen = 90;
  const scale = weight > 0 ? weightLen / weight : 0;
  const len = (value) => Math.max(0, Math.min(120, value * scale));

  const uParallel = { x: Math.cos(thetaRad), y: -Math.sin(thetaRad) };
  const uNormal = { x: -Math.sin(thetaRad), y: -Math.cos(thetaRad) };

  const arrows = [
    { label: 'W', color: '#f87171', vec: { x: 0, y: 1 }, length: len(weight), dashed: false },
    { label: 'N', color: '#34d399', vec: uNormal, length: len(normal), dashed: false },
    { label: 'F', color: '#fbbf24', vec: uParallel, length: len(friction), dashed: false },
  ];

  if (showComponents) {
    arrows.push(
      {
        label: 'W cos θ',
        color: '#38bdf8',
        vec: { x: -uNormal.x, y: -uNormal.y },
        length: len(normal),
        dashed: true,
      },
      {
        label: 'W sin θ',
        color: '#38bdf8',
        vec: { x: -uParallel.x, y: -uParallel.y },
        length: len(weightParallel),
        dashed: true,
      }
    );
  }

  return { arrows, thetaRad };
}

function drawArrow(ctx, from, to, color, dashed) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.setLineDash(dashed ? [6, 4] : []);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLength = 9;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawFbdPalette(ctx, { arrows, thetaRad }) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  const center = { x: width / 2, y: height / 2 };
  const planeHalf = Math.min(width, height) * 0.38;
  const uParallel = { x: Math.cos(thetaRad), y: -Math.sin(thetaRad) };

  const planeX1 = center.x - uParallel.x * planeHalf;
  const planeY1 = center.y - uParallel.y * planeHalf;
  const planeX2 = center.x + uParallel.x * planeHalf;
  const planeY2 = center.y + uParallel.y * planeHalf;

  ctx.strokeStyle = '#43546d';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(planeX1, planeY1);
  ctx.lineTo(planeX2, planeY2);
  ctx.stroke();

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(-thetaRad);
  ctx.fillStyle = '#e2e8f0';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-18, -12, 36, 24);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.font = '12px "Space Grotesk", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  arrows.forEach((arrow) => {
    if (arrow.length <= 0) return;
    const endX = center.x + arrow.vec.x * arrow.length;
    const endY = center.y + arrow.vec.y * arrow.length;

    drawArrow(ctx, center, { x: endX, y: endY }, arrow.color, arrow.dashed);

    const labelX = center.x + arrow.vec.x * (arrow.length + 14);
    const labelY = center.y + arrow.vec.y * (arrow.length + 14);

    ctx.fillStyle = arrow.color;
    ctx.fillText(arrow.label, labelX, labelY);
  });

  ctx.fillStyle = '#a6b2c2';
  ctx.font = '12px "Space Grotesk", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`θ = ${Math.round((thetaRad * 180) / Math.PI)}°`, 16, height - 20);
}

export function drawFbdOverlay(ctx, center, arrows, rotationRad) {
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotationRad);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-16, -10, 32, 20);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.font = '11px "Space Grotesk", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  arrows.forEach((arrow) => {
    if (arrow.length <= 0) return;
    const endX = center.x + arrow.vec.x * arrow.length;
    const endY = center.y + arrow.vec.y * arrow.length;

    drawArrow(ctx, center, { x: endX, y: endY }, arrow.color, arrow.dashed);

    const labelX = center.x + arrow.vec.x * (arrow.length + 12);
    const labelY = center.y + arrow.vec.y * (arrow.length + 12);

    ctx.fillStyle = arrow.color;
    ctx.fillText(arrow.label, labelX, labelY);
  });
}
