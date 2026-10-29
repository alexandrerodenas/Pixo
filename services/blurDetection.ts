import { getTF } from './api.ts';
import { sharpnessOf, describeBlur, type BlurResult, type BlurThresholds } from './blurMetric.ts';

export const detectBlur = async (imageElement: HTMLImageElement, thresholds: BlurThresholds = { blurry: 100, sharp: 300 }): Promise<BlurResult> => {
  const tf = await getTF();
  const raw = tf.tidy(() => sharpnessOf(tf, tf.browser.fromPixels(imageElement)));
  return describeBlur(raw, thresholds);
};
