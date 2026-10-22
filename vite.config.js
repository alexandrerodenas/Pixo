import { defineConfig } from 'vite'

// Content-Security-Policy for the production build. The page holds read/write access to the
// user's photo folder, so only our own scripts may run. Keep in sync with security-headers.inc
// (nginx) and vercel.json, which also send frame-ancestors (not allowed in a <meta> tag).
// Model weights are downloaded from TF Hub (redirects to Kaggle) and Google Cloud Storage.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "connect-src 'self' blob: https://tfhub.dev https://www.kaggle.com https://storage.googleapis.com https://huggingface.co https://*.huggingface.co https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const cspMetaTag = {
  name: 'pixo-csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head' },
  ],
}

// The ONNX Runtime wasm (26 MB) is fetched from a CDN at runtime (see workers/clip.worker.ts),
// so it must not end up in the build, and therefore in the APK.
const dropOrtWasm = {
  name: 'drop-ort-wasm',
  generateBundle(_, bundle) {
    for (const name of Object.keys(bundle)) {
      if (/ort-wasm.*\.wasm$/.test(name)) delete bundle[name];
    }
  },
};

export default defineConfig({
  base: './',
  plugins: [cspMetaTag, dropOrtWasm],
  worker: {
    format: 'es',
  },
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
})
