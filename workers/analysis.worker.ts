
// Web Worker for TF.js image analysis
// Runs classification, object detection, embedding, and blur detection off the main thread

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import '@tensorflow/tfjs-backend-webgl';
import { selectBackend } from '../services/tfBackend.ts';

let mobilenetModel: any = null;
let cocoSsdModel: any = null;
let isInitialized = false;
let initPromise: Promise<void> | null = null;
let backendName = '';

// Memoized so concurrent 'initialize' and 'analyze' messages share one model load.
function initialize(): Promise<void> {
  if (!initPromise) {
    initPromise = loadModels().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function loadModels() {

  // WebGL works in workers through OffscreenCanvas; WASM and CPU are the fallbacks.
  backendName = await selectBackend(tf, ['webgl', 'wasm', 'cpu']);

  // Load models in parallel
  const mobilenet = await import('@tensorflow-models/mobilenet');
  const cocoSsd = await import('@tensorflow-models/coco-ssd');

  [mobilenetModel, cocoSsdModel] = await Promise.all([
    mobilenet.load(),
    cocoSsd.load(),
  ]);

  isInitialized = true;
}

// Longest side of the image fed to the models. MobileNet works at 224px and COCO-SSD
// at ~300px; blur detection resizes to 512px wide, so 1024px keeps enough detail.
const ANALYSIS_MAX_SIDE = 1024;
// Shortest side of the grid thumbnail (cards are square, object-cover).
const THUMBNAIL_MIN_SIDE = 512;

async function resizeBitmap(source: ImageBitmap, scale: number): Promise<ImageBitmap> {
  return createImageBitmap(source, {
    resizeWidth: Math.max(1, Math.round(source.width * scale)),
    resizeHeight: Math.max(1, Math.round(source.height * scale)),
    resizeQuality: 'high',
  });
}

async function createThumbnail(source: ImageBitmap): Promise<Blob | null> {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const scale = Math.min(1, THUMBNAIL_MIN_SIDE / Math.min(source.width, source.height));
  const bitmap = scale < 1 ? await resizeBitmap(source, scale) : source;
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  } finally {
    if (bitmap !== source) bitmap.close();
  }
}

// Blur detection logic (pure TF tensor ops, no DOM)
function detectBlur(tfInstance: any, bitmap: ImageBitmap, blurThreshold: number, sharpThreshold: number) {
  return tfInstance.tidy(() => {
    let tensor = tfInstance.browser.fromPixels(bitmap);
    const [height, width] = tensor.shape;

    const targetWidth = 512;
    const scale = targetWidth / width;
    const targetHeight = Math.round(height * scale);

    tensor = tfInstance.image.resizeBilinear(tensor, [targetHeight, targetWidth]);

    // Grayscale
    let gray = tensor.mean(2);
    gray = gray.expandDims(0).expandDims(-1);

    // Gaussian blur (noise reduction)
    const gaussianKernel = tfInstance.tensor4d(
      [1/16, 2/16, 1/16, 2/16, 4/16, 2/16, 1/16, 2/16, 1/16],
      [3, 3, 1, 1]
    );
    gray = tfInstance.conv2d(gray, gaussianKernel, 1, 'valid');

    // Laplacian edge detection
    const laplacianKernel = tfInstance.tensor4d(
      [0, 1, 0, 1, -4, 1, 0, 1, 0],
      [3, 3, 1, 1]
    );
    const edges = tfInstance.conv2d(gray, laplacianKernel, 1, 'valid');

    // Center crop 60%
    const [, eHeight, eWidth] = edges.shape;
    const cropH = Math.floor(eHeight * 0.6);
    const cropW = Math.floor(eWidth * 0.6);
    const startH = Math.floor((eHeight - cropH) / 2);
    const startW = Math.floor((eWidth - cropW) / 2);
    const centerEdges = tfInstance.slice(edges, [0, startH, startW, 0], [1, cropH, cropW, 1]);

    const { variance } = tfInstance.moments(centerEdges);
    const rawVariance = variance.dataSync()[0];

    const normalizedScore = Math.min(100, Math.max(0, (rawVariance / 500) * 100));

    let level: 'sharp' | 'ok' | 'blurry';
    if (rawVariance < blurThreshold) level = 'blurry';
    else if (rawVariance > sharpThreshold) level = 'sharp';
    else level = 'ok';

    return {
      score: Math.round(normalizedScore),
      raw: parseFloat(rawVariance.toFixed(2)),
      level
    };
  });
}

interface AnalysisResult {
  photoId: string;
  classifications: Array<{ label: string; score: number }>;
  detections: Array<{ label: string; score: number }>;
  embedding: number[];
  blurScore: number;
  blurRaw: number;
  blurLevel: 'sharp' | 'ok' | 'blurry';
  metadata: { width: number; height: number };
  thumbnail: Blob | null;
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'initialize': {
        await initialize();
        self.postMessage({ type: 'initialized', backend: backendName });
        break;
      }

      case 'analyze': {
        if (!isInitialized) {
          await initialize();
        }

        const { photoId, file, blurThreshold = 100, sharpThreshold = 300 } = msg;

        // Decode the file once at full size, then derive a smaller copy for the models
        // and a thumbnail for the grid, so no model ever sees a full-resolution tensor.
        const original = await createImageBitmap(file as Blob);
        const metadata = { width: original.width, height: original.height };
        const analysisScale = Math.min(1, ANALYSIS_MAX_SIDE / Math.max(original.width, original.height));
        let bitmap: ImageBitmap | null = null;
        let thumbnail: Blob | null = null;
        let results: [AnalysisResult['classifications'], AnalysisResult['detections'], number[], ReturnType<typeof detectBlur>];

        try {
          bitmap = analysisScale < 1 ? await resizeBitmap(original, analysisScale) : original;
          thumbnail = await createThumbnail(original).catch(() => null);
          const image = bitmap;

          results = await Promise.all([
            (async () => {
              const preds = await mobilenetModel.classify(image);
              return preds.map((p: any) => ({
                label: p.className.split(', ')[0],
                score: p.probability,
              }));
            })(),
            (async () => {
              const dets = await cocoSsdModel.detect(image);
              return dets.map((d: any) => ({
                label: d.class,
                score: d.score,
              }));
            })(),
            (async () => {
              const embeddingTensor = mobilenetModel.infer(image, true);
              const data = await embeddingTensor.data();
              embeddingTensor.dispose();
              return Array.from(data) as number[];
            })(),
            Promise.resolve(detectBlur(tf, image, blurThreshold, sharpThreshold)),
          ]);
        } finally {
          // Free decoded pixels as soon as possible
          if (bitmap && bitmap !== original) bitmap.close();
          original.close();
        }
        const [classifications, detections, embedding, blurResult] = results;

        self.postMessage({
          type: 'result',
          photoId,
          classifications,
          detections,
          embedding,
          blurScore: blurResult.score,
          blurRaw: blurResult.raw,
          blurLevel: blurResult.level,
          metadata,
          thumbnail,
        } satisfies { type: string; photoId: string } & AnalysisResult);
        break;
      }

      case 'terminate': {
        // Dispose models and close
        if (mobilenetModel) mobilenetModel.dispose?.();
        if (cocoSsdModel) cocoSsdModel.dispose?.();
        self.close();
        break;
      }
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
      photoId: msg?.photoId,
    });
  }
};
