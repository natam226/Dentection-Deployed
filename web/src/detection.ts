export interface Detection { classId: number; confidence: number; box: [number, number, number, number] }
export interface Geometry { width: number; height: number; scale: number; padX: number; padY: number }
export function decodeDetections(data: Float32Array, dims: readonly number[], g: Geometry, conf: number, iou: number): Detection[] {
  if (dims.length !== 3 || dims[0] !== 1 || dims[1] < 5 || dims[1] > 256 || data.length !== dims[1] * dims[2]) {
    throw new Error('La salida del modelo tiene un formato no compatible.');
  }
  const anchors = dims[2], candidates: Detection[] = [];
  for (let i = 0; i < anchors; i++) {
    let score = -Infinity, classId = -1;
    for (let c = 4; c < dims[1]; c++) {
      const value = data[c * anchors + i];
      if (value > score) { score = value; classId = c - 4; }
    }
    if (!Number.isFinite(score) || score < conf) continue;
    const cx = data[i], cy = data[anchors + i], w = data[2 * anchors + i], h = data[3 * anchors + i];
    if (![cx, cy, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    const box: Detection['box'] = [
      Math.max(0, (cx-w/2-g.padX)/g.scale), Math.max(0, (cy-h/2-g.padY)/g.scale),
      Math.min(g.width, (cx+w/2-g.padX)/g.scale), Math.min(g.height, (cy+h/2-g.padY)/g.scale),
    ];
    if (box[2] > box[0] && box[3] > box[1]) candidates.push({classId, confidence:score, box});
  }
  candidates.sort((a,b) => b.confidence-a.confidence);
  const result: Detection[] = [];
  for (const candidate of candidates) {
    if (result.some(kept => kept.classId === candidate.classId && intersectionOverUnion(kept.box,candidate.box) > iou)) continue;
    result.push(candidate);
    if (result.length === 300) break;
  }
  return result;
}

export function intersectionOverUnion(a: Detection['box'], b: Detection['box']): number {
  const intersection = Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])) * Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
  return intersection / ((a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - intersection || 1);
}
