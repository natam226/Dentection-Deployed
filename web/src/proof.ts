import * as ort from 'onnxruntime-web/wasm';
import { decodeDetections } from './detection';
async function prove() {
  ort.env.wasm.numThreads = 1;
  const [bytes, expected] = await Promise.all([
    fetch('/proof/input.f32').then(r => r.arrayBuffer()), fetch('/proof/python.json').then(r => r.json()),
  ]);
  const started = performance.now();
  const session = await ort.InferenceSession.create('/model/model.onnx', { executionProviders: ['wasm'] });
  const output = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', new Float32Array(bytes), [1, 3, 640, 640]) });
  const tensor = output[session.outputNames[0]];
  const actual = decodeDetections(tensor.data as Float32Array, tensor.dims, expected.geometry, 0.25, 0.7);
  const differences = expected.detections.map((ref: any) => {
    const candidate = actual.filter(a => a.classId === ref.classId).sort((a,b) =>
      a.box.reduce((s,x,i) => s + Math.abs(x-ref.box[i]),0) - b.box.reduce((s,x,i) => s + Math.abs(x-ref.box[i]),0))[0];
    return candidate ? { coordinate: Math.max(...candidate.box.map((x,i) => Math.abs(x-ref.box[i]))), confidence: Math.abs(candidate.confidence-ref.confidence) } : { coordinate: Infinity, confidence: Infinity };
  });
  const proof = { expected: expected.detections.length, actual: actual.length, ms: performance.now()-started,
    maxCoordinateError: Math.max(0,...differences.map((d:any) => d.coordinate)),
    maxConfidenceError: Math.max(0,...differences.map((d:any) => d.confidence)), detections: actual,
    passed: actual.length === expected.detections.length && differences.every((d:any) => d.coordinate < 2 && d.confidence < 0.002) };
  (window as any).proof = proof;
  document.querySelector('#result')!.textContent = JSON.stringify(proof, null, 2);
}
prove().catch(e => { (window as any).proof = {error:String(e),passed:false}; document.querySelector('#result')!.textContent=String(e); });
