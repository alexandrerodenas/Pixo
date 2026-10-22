// Candidate labels for CLIP zero-shot classification. CLIP is not tied to a fixed vocabulary:
// adding a label here is all it takes to make it recognizable.
export const CLIP_LABELS: string[] = [
  'person', 'selfie', 'group of people', 'baby', 'child', 'crowd',
  'dog', 'cat', 'bird', 'horse', 'fish', 'insect', 'flower', 'tree', 'forest', 'garden',
  'beach', 'sea', 'mountain', 'lake', 'river', 'waterfall', 'desert', 'snow', 'sunset', 'sky', 'night sky',
  'city street', 'building', 'monument', 'bridge', 'church', 'house', 'interior room', 'kitchen', 'bedroom',
  'car', 'motorcycle', 'bicycle', 'bus', 'train', 'airplane', 'boat',
  'food', 'meal', 'dessert', 'drink', 'fruit', 'restaurant',
  'screenshot', 'document', 'receipt', 'text', 'handwriting', 'whiteboard', 'poster', 'map', 'qr code',
  'meme', 'drawing', 'painting', 'cartoon', 'logo',
  'computer screen', 'phone', 'product', 'clothing', 'shoes', 'furniture', 'tool',
  'sports', 'concert', 'party', 'wedding', 'birthday', 'festival', 'museum', 'playground',
  'landscape', 'macro close-up', 'blurry photo', 'dark photo',
];
