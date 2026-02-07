export function detectObjects(frame, prevGray, config) {
  const { data, width, height } = frame;
  const gray = new Float32Array(width * height);

  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[j] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const hasPrev = !!prevGray && prevGray.length === gray.length;
  const { edgeThreshold, motionThreshold, minArea } = config;

  const edgeMap = new Uint8Array(width * height);

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

      if (hasPrev && motionThreshold > 0) {
        const diff = Math.abs(gray[idx] - prevGray[idx]);
        if (diff < motionThreshold) continue;
      }

      edgeMap[idx] = 1;
    }
  }

  const visited = new Uint8Array(width * height);
  const objects = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const startIdx = y * width + x;
      if (!edgeMap[startIdx] || visited[startIdx]) continue;

      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;
      let count = 0;

      const stack = [startIdx];
      visited[startIdx] = 1;

      while (stack.length) {
        const idx = stack.pop();
        const cx = idx % width;
        const cy = Math.floor(idx / width);

        count += 1;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (ox === 0 && oy === 0) continue;
            const nx = cx + ox;
            const ny = cy + oy;
            if (nx <= 0 || nx >= width - 1 || ny <= 0 || ny >= height - 1) continue;
            const nIdx = ny * width + nx;
            if (!edgeMap[nIdx] || visited[nIdx]) continue;
            visited[nIdx] = 1;
            stack.push(nIdx);
          }
        }
      }

      if (count < minArea) continue;

      objects.push({
        minX,
        minY,
        maxX,
        maxY,
        centerX: sumX / count,
        centerY: sumY / count,
        area: count,
      });
    }
  }

  objects.sort((a, b) => b.area - a.area);

  return { gray, objects };
}
