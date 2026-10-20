import { describe, it, expect } from 'vitest';
import { decodeDetections } from '../src/detection';

// The fixtures are hand-derived YOLOv8 [batch, channels, anchors] outputs.
describe('YOLOv8 detections', () => {
  const geometry = { width: 1000, height: 500, scale: 0.64, padX: 0, padY: 160 };
  it('reverses letterbox padding and retains the predicted class', () => {
    const out = new Float32Array([320, 320, 128, 64, 0.1, 0.9]);
    const result = decodeDetections(out, [1, 6, 1], geometry, 0.25, 0.7);
    expect(result).toHaveLength(1);
    expect(result[0].classId).toBe(1);
    expect(result[0].confidence).toBeCloseTo(0.9);
    expect(result[0].box).toEqual([400, 200, 600, 300]);
  });
  it('suppresses same-class overlap but keeps overlapping different classes', () => {
    const out = new Float32Array([
      320, 320, 320, 320, 320, 320,
      128, 128, 128, 64, 64, 64,
      0.9, 0.8, 0.1, 0.1, 0.1, 0.95,
    ]);
    const result = decodeDetections(out, [1, 6, 3], geometry, 0.25, 0.7);
    expect(result.map(d => d.classId)).toEqual([1, 0]);
  });
  it('returns no findings for scores below threshold', () => {
    expect(decodeDetections(new Float32Array([320, 320, 128, 64, 0.1, 0.2]), [1, 6, 1], geometry, 0.25, 0.7)).toEqual([]);
  });
  it('rejects a wrong output layout instead of inventing detections', () => {
    expect(() => decodeDetections(new Float32Array(6), [1, 1, 6], geometry, 0.25, 0.7)).toThrow();
  });
  it('runs suppression before clipping boxes at the image border',()=>{
    const out=new Float32Array([0,50,60,60,200,100,100,100,.9,.8]);
    const found=decodeDetections(out,[1,5,2],{width:100,height:120,scale:1,padX:0,padY:0},.25,.7);
    expect(found).toHaveLength(2);
    expect(found.map(d=>d.box)).toEqual([[0,10,100,110],[0,10,100,110]]);
  });
});
