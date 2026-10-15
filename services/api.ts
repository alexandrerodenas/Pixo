
import type { Prediction, ModelsLoadState, ModelLoadStatus } from './types.ts';
import { detectBlur } from './blurDetection.ts';
import { analyzePhoto as workerAnalyzePhoto, ensureWorkerInitialized, getWorkerBackend } from './analysisClient.ts';

export { detectBlur }; // Re-export for consumption

// TensorFlow and its models will be loaded dynamically.
let classificationModelPromise: Promise<any> | null = null;
let detectionModelPromise: Promise<any> | null = null;
let backendName: string | null = null;
let tf: any = null;
let cocoSsd: any = null;
let mobilenet: any = null;

// --- Model Status Tracking ---
const modelStatus: ModelsLoadState = {
  classification: 'idle',
  detection: 'idle',
};
const subscribers = new Set<(status: ModelsLoadState) => void>();

const updateStatus = (model: keyof ModelsLoadState, status: ModelLoadStatus) => {
  if (modelStatus[model] !== status) {
    modelStatus[model] = status;
    notifySubscribers();
  }
};

const notifySubscribers = () => {
  // Notify with a copy to prevent mutation issues
  subscribers.forEach(callback => callback({ ...modelStatus }));
};

export const subscribeToModelStatus = (callback: (status: ModelsLoadState) => void) => {
  subscribers.add(callback);
  callback({ ...modelStatus }); // Immediately notify with the current status
  // The returned cleanup function for useEffect must not return a value.
  // An arrow function with curly braces `{}` implicitly returns `undefined`.
  return () => {
    subscribers.delete(callback);
  };
};
// --- End Model Status Tracking ---

// Exported function to get the backend name after it's been initialized.
export const getTfBackend = (): string | null => getWorkerBackend() ?? backendName;

let tfInitPromise: Promise<void> | null = null;
// Memoized so concurrent callers wait for the backend to be selected
const initializeTf = (): Promise<void> => {
  if (!tfInitPromise) tfInitPromise = loadTf();
  return tfInitPromise;
};

const loadTf = async () => {
  console.log('Dynamically loading TensorFlow.js and models...');

  // Load main libraries dynamically and in parallel
  [tf, cocoSsd, mobilenet] = await Promise.all([
    import('@tensorflow/tfjs'),
    import('@tensorflow-models/coco-ssd'),
    import('@tensorflow-models/mobilenet')
  ]);

  // Load backends (tfBackend.ts registers the WASM backend and its binaries)
  await import('@tensorflow/tfjs-backend-webgpu');
  await import('@tensorflow/tfjs-backend-webgl');
  const { selectBackend } = await import('./tfBackend.ts');

  backendName = await selectBackend(tf, ['webgpu', 'webgl', 'wasm', 'cpu']);
  console.log(`TensorFlow.js backend ready (${backendName}).`);
}

const getClassificationModel = () => {
  if (!classificationModelPromise) {
    classificationModelPromise = (async () => {
      try {
        updateStatus('classification', 'loading');
        await initializeTf();
        console.log(`Loading MobileNet classification model...`);
        const model = await mobilenet.load();
        console.log('MobileNet model loaded successfully.');
        updateStatus('classification', 'loaded');
        return model;
      } catch (error) {
        console.error('Failed to load classification model:', error);
        updateStatus('classification', 'error');
        throw error;
      }
    })();
  }
  return classificationModelPromise;
};

const getDetectionModel = () => {
  if (!detectionModelPromise) {
    detectionModelPromise = (async () => {
      try {
        updateStatus('detection', 'loading');
        await initializeTf();
        console.log('Loading COCO-SSD object detection model...');
        const model = await cocoSsd.load();
        console.log('COCO-SSD model loaded successfully.');
        updateStatus('detection', 'loaded');
        return model;
      } catch (error) {
        console.error('Failed to load detection model:', error);
        updateStatus('detection', 'error');
        throw error;
      }
    })();
  }
  return detectionModelPromise;
}

export const preloadModels = () => {
  // The worker loads its own copy of the models; the main thread only loads them
  // if the worker cannot start, so they are never downloaded and held in memory twice.
  updateStatus('classification', 'loading');
  updateStatus('detection', 'loading');
  ensureWorkerInitialized()
    .then(() => {
      updateStatus('classification', 'loaded');
      updateStatus('detection', 'loaded');
    })
    .catch((error) => {
      console.warn('Web Worker not available, loading models on the main thread.', error);
      getClassificationModel().catch(() => {});
      getDetectionModel().catch(() => {});
    });
};

// Helper function to decode a Blob into an Image element (main-thread fallback only)
const createImageElement = (file: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  }).finally(() => URL.revokeObjectURL(url));
};

// This function runs image classification using TensorFlow.js and MobileNet
export const classifyImage = async (imageElement: HTMLImageElement): Promise<Prediction[]> => {
  try {
    const model = await getClassificationModel();

    const predictions = await model.classify(imageElement);

    return predictions.map((p: { className: string, probability: number }) => ({
      label: p.className.split(', ')[0], // Get primary label
      score: p.probability,
    }));

  } catch (error) {
    console.error('Error during image classification with MobileNet:', error);
    throw error; // Re-throw to be caught by the caller
  }
};

// This function runs object detection using COCO-SSD
export const detectObjects = async (imageElement: HTMLImageElement): Promise<Prediction[]> => {
  try {
    const model = await getDetectionModel();

    const detections = await model.detect(imageElement);

    return detections.map((detection: { class: string; score: number }) => ({
      label: detection.class,
      score: detection.score,
    }));
  } catch (error) {
    console.error('Error during object detection with COCO-SSD:', error);
    throw error;
  }
}

// Generates a 1024-dim embedding vector using MobileNet's internal layer
export const generateEmbedding = async (imageElement: HTMLImageElement): Promise<number[]> => {
  try {
    const model = await getClassificationModel();

    // Use infer(img, true) to get the embedding instead of classification
    const embeddingTensor = model.infer(imageElement, true);
    const data = await embeddingTensor.data();
    embeddingTensor.dispose(); // Cleanup tensor memory immediately

    return Array.from(data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    return [];
  }
};

// Expose tf instance for advanced operations in services
export const getTF = async () => {
  await initializeTf();
  return tf;
}

// --- Worker-based batch analysis (falls back to main thread) ---

interface BatchAnalysisOptions {
  file: Blob;
  photoId: string;
  blurThreshold: number;
  sharpThreshold: number;
}

interface BatchAnalysisResult {
  photoId: string;
  classifications: Prediction[];
  detections: Prediction[];
  embedding: number[];
  blurScore: number;
  blurRaw: number;
  blurLevel: 'sharp' | 'ok' | 'blurry';
  metadata: {
    width: number;
    height: number;
  };
  thumbnail?: Blob | null;
}

/**
 * Analyze a photo using all AI models.
 * Uses Web Worker if available, falls back to main thread.
 */
export const analyzePhotoBatch = async (options: BatchAnalysisOptions): Promise<BatchAnalysisResult> => {
  const { file, photoId, blurThreshold, sharpThreshold } = options;

  // Try Web Worker first
  if (typeof Worker !== 'undefined') {
    try {
      const result = await workerAnalyzePhoto({
        file,
        photoId,
        blurThreshold,
        sharpThreshold,
      });
      return result as BatchAnalysisResult;
    } catch (workerError) {
      console.warn('Worker analysis failed, falling back to main thread:', workerError);
      // Fall through to main thread
    }
  }

  // Main thread fallback: decode once and share the element between all models
  const img = await createImageElement(file);

  const metadata = {
    width: img.naturalWidth,
    height: img.naturalHeight,
  };

  const [classifications, detections, embedding, blurResult] = await Promise.all([
    classifyImage(img),
    detectObjects(img),
    generateEmbedding(img),
    detectBlur(img, { blurry: blurThreshold, sharp: sharpThreshold }),
  ]);

  return {
    photoId,
    classifications,
    detections,
    embedding,
    blurScore: blurResult.score,
    blurRaw: blurResult.raw,
    blurLevel: blurResult.level,
    metadata,
  };
};
