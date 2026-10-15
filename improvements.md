# Improvements — Pixo

This document catalogs technical debt, performance opportunities, and feature ideas
identified during code review. They are **not** bugs — the application works correctly
as-is. These are refinements for future iterations.

---

## Performance

### Virtual Scrolling (react-window / @tanstack/virtual)
**Why:** With 1000+ photos, the DOM builds 1000+ nodes. Scroll and layout become sluggish.
The grid view renders every photo unconditionally.
**How:** Replace the flat `.map()` in `PhotoGrid` with a virtualized list that only
renders visible + overscan nodes.

### Web Worker for TensorFlow.js
**Why:** `classifyImage`, `detectObjects`, `generateEmbedding`, and `detectBlur` all run
on the main thread. While each call is fast, a batch of 100 photos can freeze the UI
for several seconds.
**How:** Offload TF.js work to a dedicated Web Worker. Serialize data URLs to the
worker, receive predictions back via `postMessage`.

### Thumbnail Cache (IndexedDB)
**Why:** Every directory load re-creates blob URLs from scratch. Returning to a
previously-opened folder re-analyzes thumbnails.
**How:** Store `objectURL` → `blob` mappings in IndexedDB. On reload, check cache
before fetching + creating new blob URLs.

### Revoke Blob URLs on Unmount
**Why:** The app creates `URL.createObjectURL()` for every photo but never revokes them
on component unmount. Switching directories leaks memory until the tab is closed.
**How:** Collect all active objectURLs in a `Set` and call `URL.revokeObjectURL()` in a
`useEffect` cleanup or when loading a new directory.

---

## Code Quality

### Merge Duplicate `useEffect` in PhotoCard
**Why:** `PhotoCard.tsx` has two separate `useEffect` blocks — one for
`IntersectionObserver` (lazy loading), another for click-timeout cleanup. They can
share a single `useEffect` return for cleanup.

### Reduce `useCallback` Wrapping
**Why:** Several hooks wrap trivial event handlers in `useCallback` with large
dependency arrays. The memoization cost sometimes exceeds the rerender cost.
**How:** Profile with React DevTools; inline handlers that don't benefit from
referential stability.

### Type-Safe `(window as any).showDirectoryPicker`
**Why:** The code casts `window` to `any` to access File System API. TypeScript
doesn't know about these APIs yet (they are experimental).
**How:** Declare an ambient type module (`.d.ts`) for the File System Access API
instead of casting everywhere. Keep it minimal — only the methods used.

---

## Features (Future)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| Medium | **EXIF Metadata** | Parse date, camera, GPS → enable timeline filters, map view |
| Medium | **Undo / Trash** | Current delete is permanent. Soft-delete with 30-day trash reduces accidents |
| Low | **Video Support** | Accept `.mp4`, `.mov`, `.avi`. Extract first frame as thumbnail |
| Low | **Export CSV** | Allow users to download a spreadsheet of photo locations, predictions, scores |
| Low | **Keyboard Shortcuts** | Global hotkeys for Select All, Delete, Toggle Save, etc. (currently only in Zen Mode) |
| Low | **Global i18n** | French, German, Spanish locale files. The UI is fully in English |
| Low | **Photo Rating (1-5)** | Beyond the binary heart/saved toggle |

---

## Build & Tooling

### Remove `@types/node` Dev Dependency
**Why:** The project does not use Node.js APIs. `@types/node` is installed but never
imported.
