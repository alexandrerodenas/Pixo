// Sharpness measure shared by the analysis worker and the main-thread fallback.
//
// The variance of the Laplacian over a whole photo drops as soon as part of it is out of focus, so
// portraits (sharp subject, blurred background) and off-centre subjects were reported as blurry.
// The photo is cut into a grid and each cell gets its own variance: it is blurry only when even its
// sharpest cells are soft. Smoothed edges first, so grain is not mistaken for detail.

export interface BlurResult {
  score: number; // 0-100 normalized
  raw: number;   // Sharpness of the best cells (variance of the Laplacian)
  level: 'sharp' | 'ok' | 'blurry';
}

export interface BlurThresholds {
  blurry: number; // Below this is blurry
  sharp: number;  // Above this is sharp
}

// Blur is measured at a fixed width: variance scales with resolution, so thresholds need it
export const BLUR_TARGET_WIDTH = 512;
const GRID = 6;
// Share of the cells that count (the sharpest ones): under a tenth of the picture
const BEST_CELLS = 3;
const SCORE_FULL_AT = 500;

const GAUSSIAN_KERNEL = [1 / 16, 2 / 16, 1 / 16, 2 / 16, 4 / 16, 2 / 16, 1 / 16, 2 / 16, 1 / 16];
const LAPLACIAN_KERNEL = [0, 1, 0, 1, -4, 1, 0, 1, 0];

/** Raw sharpness of an RGB tensor [h, w, 3]; call it inside tf.tidy(). */
export function sharpnessOf(tf: any, rgb: any): number {
  const [height, width] = rgb.shape;
  const resized = tf.image.resizeBilinear(rgb, [Math.round(height * (BLUR_TARGET_WIDTH / width)), BLUR_TARGET_WIDTH]);
  let gray = resized.mean(2).expandDims(0).expandDims(-1);

  gray = tf.conv2d(gray, tf.tensor4d(GAUSSIAN_KERNEL, [3, 3, 1, 1]), 1, 'valid');
  const edges = tf.conv2d(gray, tf.tensor4d(LAPLACIAN_KERNEL, [3, 3, 1, 1]), 1, 'valid');

  const [, eHeight, eWidth] = edges.shape;
  const cellH = Math.floor(eHeight / GRID);
  const cellW = Math.floor(eWidth / GRID);
  if (cellH < 2 || cellW < 2) return tf.moments(edges).variance.dataSync()[0];

  // [1, h, w, 1] -> [GRID, cellH, GRID, cellW] -> [GRID, GRID, cellH, cellW]: one row of pixels per cell
  const grid = tf.slice(edges, [0, 0, 0, 0], [1, cellH * GRID, cellW * GRID, 1])
    .reshape([GRID, cellH, GRID, cellW])
    .transpose([0, 2, 1, 3])
    .reshape([GRID * GRID, cellH * cellW]);
  const variances = Array.from(tf.moments(grid, 1).variance.dataSync() as Float32Array).sort((a, b) => b - a);
  const best = variances.slice(0, BEST_CELLS);
  return best.reduce((sum, v) => sum + v, 0) / best.length;
}

export function describeBlur(raw: number, thresholds: BlurThresholds): BlurResult {
  const level = raw < thresholds.blurry ? 'blurry' : raw > thresholds.sharp ? 'sharp' : 'ok';
  return {
    score: Math.round(Math.min(100, Math.max(0, (raw / SCORE_FULL_AT) * 100))),
    raw: parseFloat(raw.toFixed(2)),
    level,
  };
}
