import { Capacitor, registerPlugin } from '@capacitor/core';

// Android app only: Android's WebView has no File System Access API, so window.showDirectoryPicker is
// provided here on top of the native FolderAccess plugin (Storage Access Framework, see
// android/.../FolderAccessPlugin.java). Only the subset Pixo uses is implemented: listing, reading,
// creating, writing and deleting entries.

interface NativeEntry {
  uri: string;
  name: string;
  isDirectory: boolean;
  mimeType: string;
  size: number;
  lastModified: number;
}

interface FolderAccessPlugin {
  pickDirectory(): Promise<{ uri: string; name: string }>;
  list(options: { uri: string }): Promise<{ entries: NativeEntry[] }>;
  createFile(options: { parentUri: string; name: string; mimeType: string }): Promise<{ uri: string; name: string }>;
  createDirectory(options: { parentUri: string; name: string }): Promise<{ uri: string; name: string }>;
  delete(options: { uri: string }): Promise<void>;
  writeFile(options: { uri: string; data: string; append: boolean }): Promise<void>;
}

const FolderAccess = registerPlugin<FolderAccessPlugin>('FolderAccess');

// Served by FolderAccessWebViewClient.java
const FILE_ENDPOINT = '/_pixo_folder/file';
// Bytes sent per bridge call when writing, kept small since they travel as base64 strings
const WRITE_CHUNK_BYTES = 2 * 1024 * 1024;

const notFound = (name: string) => new DOMException(`${name} not found`, 'NotFoundError');

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

class NativeFileHandle {
  readonly kind = 'file' as const;

  constructor(readonly name: string, readonly uri: string, private readonly mimeType: string) {}

  async getFile(): Promise<File> {
    const response = await fetch(`${FILE_ENDPOINT}?uri=${encodeURIComponent(this.uri)}`);
    if (!response.ok) throw notFound(this.name);
    const blob = await response.blob();
    return new File([blob], this.name, { type: blob.type || this.mimeType });
  }

  async createWritable() {
    const parts: Blob[] = [];
    const uri = this.uri;
    return {
      async write(data: Blob | BufferSource | string) {
        parts.push(data instanceof Blob ? data : new Blob([data]));
      },
      async close() {
        const blob = new Blob(parts);
        // Always send a first (truncating) write, so an empty file is still written.
        for (let offset = 0; offset === 0 || offset < blob.size; offset += WRITE_CHUNK_BYTES) {
          const data = await blobToBase64(blob.slice(offset, offset + WRITE_CHUNK_BYTES));
          await FolderAccess.writeFile({ uri, data, append: offset > 0 });
        }
      },
    };
  }
}

class NativeDirectoryHandle {
  readonly kind = 'directory' as const;
  // Children by name, loaded on first use and kept in sync with our own changes.
  private children: Map<string, NativeEntry> | null = null;

  constructor(readonly name: string, readonly uri: string) {}

  private async getChildren(): Promise<Map<string, NativeEntry>> {
    if (!this.children) {
      const { entries } = await FolderAccess.list({ uri: this.uri });
      this.children = new Map(entries.map(e => [e.name, e]));
    }
    return this.children;
  }

  async *values(): AsyncGenerator<NativeFileHandle | NativeDirectoryHandle> {
    this.children = null; // A new scan always reflects what is on disk now
    for (const entry of (await this.getChildren()).values()) {
      yield entry.isDirectory
        ? new NativeDirectoryHandle(entry.name, entry.uri)
        : new NativeFileHandle(entry.name, entry.uri, entry.mimeType);
    }
  }

  async *entries(): AsyncGenerator<[string, NativeFileHandle | NativeDirectoryHandle]> {
    for await (const handle of this.values()) yield [handle.name, handle];
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<NativeDirectoryHandle> {
    const children = await this.getChildren();
    const existing = children.get(name);
    if (existing) {
      if (!existing.isDirectory) throw new DOMException(`${name} is not a directory`, 'TypeMismatchError');
      return new NativeDirectoryHandle(existing.name, existing.uri);
    }
    if (!options?.create) throw notFound(name);
    const created = await FolderAccess.createDirectory({ parentUri: this.uri, name });
    children.set(created.name, { ...created, isDirectory: true, mimeType: '', size: 0, lastModified: Date.now() });
    return new NativeDirectoryHandle(created.name, created.uri);
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<NativeFileHandle> {
    const children = await this.getChildren();
    const existing = children.get(name);
    if (existing) {
      if (existing.isDirectory) throw new DOMException(`${name} is a directory`, 'TypeMismatchError');
      return new NativeFileHandle(existing.name, existing.uri, existing.mimeType);
    }
    if (!options?.create) throw notFound(name);
    const mimeType = guessMimeType(name);
    const created = await FolderAccess.createFile({ parentUri: this.uri, name, mimeType });
    children.set(created.name, { ...created, isDirectory: false, mimeType, size: 0, lastModified: Date.now() });
    return new NativeFileHandle(created.name, created.uri, mimeType);
  }

  async removeEntry(name: string): Promise<void> {
    const children = await this.getChildren();
    const existing = children.get(name);
    if (!existing) throw notFound(name);
    await FolderAccess.delete({ uri: existing.uri });
    children.delete(name);
  }
}

function guessMimeType(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', json: 'application/json' };
  return types[ext] ?? 'application/octet-stream';
}

async function showDirectoryPicker(): Promise<FileSystemDirectoryHandle> {
  try {
    const { uri, name } = await FolderAccess.pickDirectory();
    return new NativeDirectoryHandle(name, uri) as unknown as FileSystemDirectoryHandle;
  } catch (error) {
    if ((error as { code?: string }).code === 'CANCELLED') throw new DOMException('Folder selection cancelled', 'AbortError');
    throw error;
  }
}

/** Provides window.showDirectoryPicker in the Android app. Does nothing in the browser. */
export function installNativeFileSystem(): void {
  if (Capacitor.getPlatform() !== 'android') return;
  window.showDirectoryPicker = showDirectoryPicker as Window['showDirectoryPicker'];
}
