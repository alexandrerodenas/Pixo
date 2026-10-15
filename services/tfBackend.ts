// Shared TF.js backend selection for the main thread and the analysis worker.
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import wasmUrl from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm?url';
import wasmSimdUrl from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-simd.wasm?url';
import wasmThreadedSimdUrl from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-threaded-simd.wasm?url';

// Serve the WASM binaries from our own origin (they are not fetched from a CDN).
setWasmPaths({
  'tfjs-backend-wasm.wasm': wasmUrl,
  'tfjs-backend-wasm-simd.wasm': wasmSimdUrl,
  'tfjs-backend-wasm-threaded-simd.wasm': wasmThreadedSimdUrl,
});

/**
 * Tries each backend in order and returns the name of the first one that initializes.
 * tf.setBackend() throws when a backend is not registered but only returns false
 * when it is registered and fails to initialize, so both cases are handled.
 */
export async function selectBackend(tf: any, candidates: string[]): Promise<string> {
  for (const name of candidates) {
    try {
      if (await tf.setBackend(name)) {
        await tf.ready();
        return name.toUpperCase();
      }
    } catch (error) {
      console.warn(`TF.js backend "${name}" unavailable:`, error);
    }
  }
  throw new Error(`No TF.js backend available (tried ${candidates.join(', ')})`);
}
