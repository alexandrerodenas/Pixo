
import { Photo, DuplicateGroup, PhotoStatus } from './types.js';
import { getTF } from './api.ts';

// Similarity threshold for considering two photos as duplicates
// 0.98 is very strict (near exact), 0.92 handles slight bursts/crops.
const DUPLICATE_THRESHOLD = 0.94;
// Rows of the similarity matrix computed at once
const SIMILARITY_BLOCK_ROWS = 256;

export const findDuplicateGroups = async (photos: Photo[]): Promise<DuplicateGroup[]> => {
  const analyzedPhotos = photos.filter(p => p.status === PhotoStatus.ANALYZED && p.embedding && p.embedding.length > 0);

  if (analyzedPhotos.length < 2) return [];

  const tf = await getTF();

  const count = analyzedPhotos.length;
  const embeddingSize = analyzedPhotos[0].embedding!.length;

  // 1. Flatten all embeddings [N, D] and normalize them to unit length (L2),
  // so a dot product is the cosine similarity.
  const flatEmbeddings = new Float32Array(count * embeddingSize);
  analyzedPhotos.forEach((p, i) => {
    flatEmbeddings.set(p.embedding!, i * embeddingSize);
  });
  const normalizedEmbeddings = tf.tidy(() => {
    const matrix = tf.tensor2d(flatEmbeddings, [count, embeddingSize]);
    return matrix.div(matrix.norm('euclidean', 1, true));
  });

  // 2. Grouping Logic using Disjoint Set (Union-Find)
  const parent = new Array(count).fill(0).map((_, i) => i);

  function find(i: number): number {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }

  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootJ] = rootI;
    }
  }

  // 3. Compute the similarity matrix one block of rows at a time ([B, N] instead of [N, N]),
  // so memory stays bounded (10,000 photos: ~10 MB per block instead of 400 MB at once).
  try {
    for (let start = 0; start < count; start += SIMILARITY_BLOCK_ROWS) {
      const rows = Math.min(SIMILARITY_BLOCK_ROWS, count - start);
      const blockValues = tf.tidy(() => {
        const block = normalizedEmbeddings.slice([start, 0], [rows, embeddingSize]);
        return tf.matMul(block, normalizedEmbeddings, false, true).dataSync() as Float32Array;
      });

      // Upper triangle only: compare row i with every later photo j
      for (let r = 0; r < rows; r++) {
        const i = start + r;
        for (let j = i + 1; j < count; j++) {
          if (blockValues[r * count + j] >= DUPLICATE_THRESHOLD) {
            union(i, j);
          }
        }
      }
      // Let the UI breathe between blocks
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  } finally {
    normalizedEmbeddings.dispose();
  }

  // 4. Build Groups
  const groupsMap = new Map<number, string[]>();
  for (let i = 0; i < count; i++) {
    const root = find(i);
    if (!groupsMap.has(root)) {
      groupsMap.set(root, []);
    }
    groupsMap.get(root)!.push(analyzedPhotos[i].id);
  }

  // Filter out groups with only 1 photo
  const photosById = new Map(photos.map(p => [p.id, p]));
  const groups: DuplicateGroup[] = [];
  for (const photoIds of groupsMap.values()) {
    if (photoIds.length > 1) {
      groups.push(createDuplicateGroup(photoIds, photosById));
    }
  }

  return groups;
};

// Helper to determine the "Best" photo in a group
function createDuplicateGroup(photoIds: string[], photosById: Map<string, Photo>): DuplicateGroup {
  const groupPhotos = photoIds.map(id => photosById.get(id)!).filter(Boolean);

  // Sort criteria:
  // 1. Resolution (Area) Descending
  // 2. File Size Descending
  // 3. Date Ascending (Keep oldest/original)

  groupPhotos.sort((a, b) => {
    const areaA = (a.metadata?.width || 0) * (a.metadata?.height || 0);
    const areaB = (b.metadata?.width || 0) * (b.metadata?.height || 0);
    if (areaA !== areaB) return areaB - areaA;

    const sizeA = a.metadata?.size || 0;
    const sizeB = b.metadata?.size || 0;
    if (sizeA !== sizeB) return sizeB - sizeA;

    return (a.metadata?.lastModified || 0) - (b.metadata?.lastModified || 0);
  });

  return {
    id: crypto.randomUUID(),
    photos: photoIds,
    bestPhotoId: groupPhotos[0].id
  };
}
