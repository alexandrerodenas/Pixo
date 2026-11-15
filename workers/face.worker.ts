// Web Worker for face recognition (face-api, on the same TF.js as the rest of the app).
// Finds the faces in a photo and returns, for each one, a 128-number "descriptor": two photos of the
// same person give close descriptors. Everything runs on the device; the model weights (about 7 MB)
// are downloaded at first use and cached by the browser. Nothing about the faces leaves the phone.

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import '@tensorflow/tfjs-backend-webgl';
import * as faceapi from '@vladmandic/face-api/dist/face-api.esm-nobundle.js';
import { selectBackend } from '../services/tfBackend.ts';

// Weights published with the npm package (MIT). jsDelivr is already allowed by the CSP.
const DEFAULT_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/';

// Longest side the detector works on: small faces in group photos need some resolution
const ANALYSIS_MAX_SIDE = 1280;
// Faces smaller than this (in pixels, at analysis size) give unreliable descriptors and are ignored
const MIN_FACE_SIDE = 40;
const MIN_SCORE = 0.5;
const THUMBNAIL_SIDE = 112;

let initPromise: Promise<{ backend: string; loadMs: number }> | null = null;

// face-api expects a browser "environment" (canvas, fetch...). In a worker there is no DOM: give it
// OffscreenCanvas instead. Inputs are always tensors, so it never needs to decode images itself.
function patchEnvironment() {
  const createCanvas = () => new OffscreenCanvas(1, 1) as unknown as HTMLCanvasElement;
  faceapi.env.setEnv({
    Canvas: OffscreenCanvas as any,
    CanvasRenderingContext2D: (self as any).OffscreenCanvasRenderingContext2D,
    Image: ImageBitmap as any,
    ImageData,
    Video: class {} as any,
    createCanvasElement: createCanvas,
    createImageElement: () => { throw new Error('No images in the face worker'); },
    fetch: (url: string, init?: RequestInit) => fetch(url, init),
    readFile: () => { throw new Error('No file system in the face worker'); },
  } as any);
}

function initialize(modelUrl: string) {
  initPromise ??= (async () => {
    const start = performance.now();
    patchEnvironment();
    const backend = await selectBackend(tf, ['webgl', 'wasm', 'cpu']);
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]);
    return { backend, loadMs: Math.round(performance.now() - start) };
  })().catch(error => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

async function cropThumbnail(bitmap: ImageBitmap, box: { x: number; y: number; width: number; height: number }): Promise<Blob | null> {
  // A bit of margin around the face, square
  const side = Math.max(box.width, box.height) * 1.4;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const sx = Math.max(0, cx - side / 2);
  const sy = Math.max(0, cy - side / 2);
  const sw = Math.min(bitmap.width - sx, side);
  const sh = Math.min(bitmap.height - sy, side);
  const canvas = new OffscreenCanvas(THUMBNAIL_SIDE, THUMBNAIL_SIDE);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, THUMBNAIL_SIDE, THUMBNAIL_SIDE);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
}

export interface DetectedFace {
  box: { x: number; y: number; width: number; height: number }; // relative to the photo, 0..1
  score: number;
  descriptor: Float32Array; // 128 numbers
  thumbnail: Blob | null;
}

async function detectFaces(blob: Blob): Promise<DetectedFace[]> {
  const original = await createImageBitmap(blob);
  const scale = Math.min(1, ANALYSIS_MAX_SIDE / Math.max(original.width, original.height));
  const bitmap = scale < 1
    ? await createImageBitmap(original, {
      resizeWidth: Math.round(original.width * scale),
      resizeHeight: Math.round(original.height * scale),
      resizeQuality: 'high',
    })
    : original;
  if (bitmap !== original) original.close();

  const input = tf.browser.fromPixels(bitmap) as tf.Tensor3D;
  try {
    const results = await faceapi
      .detectAllFaces(input as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: MIN_SCORE }))
      .withFaceLandmarks(true)
      .withFaceDescriptors();

    const faces: DetectedFace[] = [];
    for (const result of results) {
      const { x, y, width, height } = result.detection.box;
      if (Math.min(width, height) < MIN_FACE_SIDE) continue;
      faces.push({
        box: { x: x / bitmap.width, y: y / bitmap.height, width: width / bitmap.width, height: height / bitmap.height },
        score: result.detection.score,
        descriptor: result.descriptor,
        thumbnail: await cropThumbnail(bitmap, { x, y, width, height }).catch(() => null),
      });
    }
    return faces;
  } finally {
    input.dispose();
    bitmap.close();
  }
}

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data;
  try {
    if (msg.type === 'initialize') {
      self.postMessage({ type: 'initialized', ...(await initialize(msg.modelUrl || DEFAULT_MODEL_URL)) });
    } else if (msg.type === 'detect') {
      await initialize(msg.modelUrl || DEFAULT_MODEL_URL);
      const start = performance.now();
      const faces = await detectFaces(msg.file as Blob);
      self.postMessage({ type: 'result', photoId: msg.photoId, faces, ms: Math.round(performance.now() - start) });
    }
  } catch (error) {
    self.postMessage({ type: 'error', photoId: msg?.photoId, error: error instanceof Error ? error.message : String(error) });
  }
};
