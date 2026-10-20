"""Export the existing weights and prepare a reproducible, local parity check."""
from pathlib import Path
import argparse
import base64
import json
import hashlib
import cv2
import numpy as np
from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    weights = root / 'modelo/best_dental_kaggle.pt'
    dest = root / 'web/public/model'
    evidence = root / 'work/parity'
    dest.mkdir(parents=True, exist_ok=True)
    evidence.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(weights))
    exported = Path(model.export(format='onnx', imgsz=640, dynamic=False, opset=17,
                                 simplify=False, nms=False, batch=1, device='cpu'))
    target = dest / 'model.onnx'
    target.write_bytes(exported.read_bytes())
    names = [model.names[i] for i in range(len(model.names))]
    metadata = {'version': 'dental-yolov8n-2025', 'inputSize': 640, 'names': names,
                'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                'weightsSha256': hashlib.sha256(weights.read_bytes()).hexdigest()}
    (dest / 'metadata.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    if args.image:
        img = cv2.imread(str(args.image))
    else:
        notebook = json.loads((root / 'modelo/detection_model_yolov8.ipynb').read_text(encoding='utf-8'))
        candidates = [o['data']['image/png'] for c in notebook['cells'] for o in c.get('outputs', [])
                      if 'image/png' in o.get('data', {})]
        if not candidates:
            raise RuntimeError('No existing image fixture: supply --image with an authorized sample')
        raw = candidates[0]
        img = cv2.imdecode(np.frombuffer(base64.b64decode(''.join(raw)), dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError('Cannot decode parity image')
    cv2.imwrite(str(evidence / 'input.png'), img)
    height, width = img.shape[:2]
    scale = min(640 / width, 640 / height)
    nw, nh = round(width * scale), round(height * scale)
    left, top = round((640 - nw) / 2 - 0.1), round((640 - nh) / 2 - 0.1)
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)
    padded = cv2.copyMakeBorder(resized, top, 640-nh-top, left, 640-nw-left, cv2.BORDER_CONSTANT, value=(114,114,114))
    tensor = np.ascontiguousarray(padded[:, :, ::-1].transpose(2,0,1), dtype=np.float32) / 255
    tensor.tofile(str(evidence / 'input.f32'))
    predictions = model.predict(img, imgsz=640, rect=False, conf=0.25, iou=0.7, device='cpu', verbose=False)[0]
    boxes = [{'classId': int(b.cls[0]), 'confidence': float(b.conf[0]),
              'box': [float(v) for v in b.xyxy[0]]} for b in predictions.boxes]
    proof = {'geometry': {'width': width, 'height': height, 'scale': scale, 'padX': left, 'padY': top},
             'detections': boxes, 'fixture': 'first existing notebook plot; runtime equivalence only, not a clinical accuracy benchmark'}
    (evidence / 'python.json').write_text(json.dumps(proof, indent=2), encoding='utf-8')
    # Authorized samples stay outside public assets. Vite serves these files only in local dev.
    print(json.dumps({'model': str(target), 'bytes': target.stat().st_size,
                      'classes': len(names), 'pythonDetections': len(boxes)}))


if __name__ == '__main__':
    main()
