const CACHE_NAME = 'handstand-v3';

const LOCAL_ASSETS = [
  'index.html',
  'icon.svg',
  'manifest.json'
];

// Model files served locally — populated on first request via fetch handler
// (they may not exist at install time; the fetch handler caches them lazily)
const MODEL_PATHS = [
  'models/yolov8n.onnx',
  'models/osnet_x0_25.onnx',
];

// MediaPipe + ONNX Runtime Web CDN assets — JS + WASM + model files
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_solution_packed_assets_loader.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_solution_simd_wasm_bin.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_solution_packed_assets.data',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_solution_simd_wasm_bin.wasm',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose_web.binarypb',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort-wasm-simd-threaded.wasm',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort-wasm-simd.wasm',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort-wasm.wasm',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Cache local assets first (fast), then CDN + model assets (can be slow)
      cache.addAll(LOCAL_ASSETS).then(() => {
        const allUrls = [...CDN_ASSETS, ...MODEL_PATHS];
        return Promise.allSettled(
          allUrls.map(url =>
            fetch(url, { mode: url.startsWith('http') ? 'cors' : 'same-origin' })
              .then(res => {
                if (res.ok) return cache.put(url, res);
              })
              .catch(() => {})
          )
        );
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Cache-first: use cached version, update in background
      const fetchPromise = fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
