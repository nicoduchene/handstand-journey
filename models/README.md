# Models

The person-tracking pipeline needs two ONNX models. They are not bundled in this
repo (combined ~13MB) — drop them into this directory before first use, or let
the service worker fetch them on the first calibration.

## Required files

### `yolov8n.onnx` — person detection (~12MB)

Export from Ultralytics YOLOv8n:

```bash
pip install ultralytics
yolo export model=yolov8n.pt format=onnx opset=12 imgsz=640 simplify=True
```

Or download a pre-exported version from Ultralytics releases:
<https://github.com/ultralytics/assets/releases>

The model takes `[1, 3, 640, 640]` float32 in `[0,1]` (RGB, CHW). Output is
`[1, 84, 8400]` (transposed) or `[1, 8400, 84]` — the JS handles both layouts.
We only consume class 0 (person).

### `osnet_x0_25.onnx` — person re-identification (~0.8MB)

Export from torchreid:

```bash
pip install torch torchreid
python - <<'EOF'
import torch, torchreid
m = torchreid.models.build_model('osnet_x0_25', num_classes=1, pretrained=True)
m.eval()
x = torch.randn(1, 3, 256, 128)
torch.onnx.export(m, x, 'osnet_x0_25.onnx', opset_version=12,
                  input_names=['input'], output_names=['embedding'],
                  dynamic_axes={'input': {0: 'batch'}, 'embedding': {0: 'batch'}})
EOF
```

The model takes `[1, 3, 256, 128]` float32, ImageNet-normalised (RGB, CHW).
Output is a 256-dim embedding; the JS L2-normalises it before use.

## Notes

- Models are loaded with WebGPU when available, falling back to WASM.
- The service worker caches them under the same path on first hit.
- Without these files, person tracking is silently disabled and the app falls
  back to MediaPipe-only behaviour (no regression in single-person use).
