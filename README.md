
<p align="center">
  <img src="public/logo.png" alt="Pixo Logo" width="128">
</p>

<h1 align="center">Pixo</h1>

<p align="center">
  <em>Organize your photos effortlessly.</em>
</p>

<p align="center">
  <a href="https://github.com/alexandrerodenas/Pixo/blob/develop/LICENSE"><img src="https://img.shields.io/github/license/alexandrerodenas/Pixo?color=blue" alt="License"></a>
  <a href="https://github.com/alexandrerodenas/Pixo/releases"><img src="https://img.shields.io/github/package-json/v/alexandrerodenas/Pixo?color=green" alt="Version"></a>
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.7">
  <img src="https://img.shields.io/badge/TensorFlow.js-4.20-FF6F00?logo=tensorflow&logoColor=white" alt="TensorFlow.js 4.20">
  <img src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" alt="Vite 6">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker">
  <a href="https://github.com/alexandrerodenas/Pixo/commits/develop"><img src="https://img.shields.io/github/last-commit/alexandrerodenas/Pixo?color=blue" alt="Last commit"></a>
</p>

## 📱 Android app (APK)

**[⬇️ Download the latest Android APK](https://github.com/alexandrerodenas/Pixo/releases/download/android-debug/pixo-debug.apk)** (debug build, rebuilt on every change to the app)

1. Open the link on your Android phone and download `pixo-debug.apk`.
2. Allow installs from this source when Android asks (*Install unknown apps*).
3. Open **Pixo**, tap **Scan Phone**, and allow access to your photos.

Everything you already see on the web version is there, and the app scans **every photo on the phone** (no folder to pick). Deleted photos go to the gallery's trash (recoverable for 30 days), and saved photos are moved to `Pictures/saves`.

> Requires Android 7.0 or newer. The APK is not signed for the Play Store: you install it by hand, and future builds update it in place. More builds: [all releases](https://github.com/alexandrerodenas/Pixo/releases).

Pixo is a privacy-first web application that organizes your local photos using AI — entirely in your browser. No uploads, no servers, no data collection.

Leveraging the File System Access API and TensorFlow.js, it runs MobileNet and COCO-SSD models locally for scene classification, object detection, blur scoring, and duplicate matching.

## Features

- **100% Local & Private** — All processing stays in your browser. Your photos never leave your machine.
- **AI Analysis** — Scene classification (MobileNet) and object detection (COCO-SSD), accelerated via WebGPU, WASM, or WebGL.
- **Blur Detection** — Laplacian Variance analysis on GPU, scoring each photo 0–100 with visual indicators.
- **Duplicate Detection** — Semantic embeddings to find exact duplicates, near-duplicates, and burst photos, auto-selecting the best version.
- **Dual View Modes** — Grid View for browsing, Folder View grouped by AI classification labels.
- **Custom Rules** — Create classification and detection rules (e.g., *"SELECT photos with 'beach' classification > 80%"*) with optional auto-apply.
- **Uncertainty Filtering** — Configurable threshold to flag ambiguous photos as *Uncategorized* for manual review.
- **Save & Organize** — Mark favorites, isolate selections, move saved photos to a dedicated folder, or permanently delete.
- **Dark Mode** — Respects your system's appearance settings.
- **Profile Import/Export** — Backup or share your rules and preferences as JSON.

## Quick Start

### Android

See [📱 Android app (APK)](#-android-app-apk) above.

### Direct Browser

Open `index.html` in a browser supporting the File System Access API (Chrome, Edge). Follow the onboarding, then select a photo directory.

### Docker

```bash
docker build -t pixo .
docker run -d -p 8080:80 pixo
```

Open [http://localhost:8080](http://localhost:8080).

> **Note**: `localhost` is treated as a secure context by browsers, satisfying the File System Access API requirement.

## Usage

1. **Onboarding** — Enter your name to create a profile with sensible default rules.
2. **Load Photos** — Click *Select Directory* in the sidebar (web), or *Scan Phone* (Android app).
3. **AI Analysis** — Models run automatically; track progress in real-time.
4. **Organize** — Find duplicates, isolate blurry shots, mark favorites, apply rules, move or delete.
5. **Customize** — Add rules, adjust uncertainty threshold, change the saved folder name, export your profile.

## Tech Stack

**React 19**, **TypeScript**, **TensorFlow.js** (MobileNet, COCO-SSD), **Vite**, **Tailwind CSS**, **Docker**.

## Build the Android app

```bash
npm install
npm run android:sync   # builds the web app and copies it into android/
cd android && ./gradlew assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. CI builds the same file on every push to a pull request that touches the Android code (see `.github/workflows/android.yml`).

## Roadmap

### Performance

| # | Improvement | Why |
|---|-------------|-----|
| 1 | **IndexedDB Thumbnail Cache** | Every directory load re-creates blob URLs from scratch. Returning to a previously-opened folder re-analyzes thumbnails. |

### Code Quality

| # | Improvement |
|---|-------------|
| 2 | Reduce unnecessary `useCallback` wrapping — memoization cost sometimes outweighs rerender cost |

### Features (Future)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| Medium | **EXIF Metadata** | Parse date, camera, GPS → enable timeline filters, map view |
| Medium | **Undo / Trash** | Current delete is permanent. Soft-delete with 30-day trash reduces accidents |
| Low | **Video Support** | Accept `.mp4`, `.mov`, `.avi`. Extract first frame as thumbnail |
| Low | **Export CSV** | Download a spreadsheet of photo locations, predictions, scores |
| Low | **Global Keyboard Shortcuts** | Select All, Delete, Toggle Save, etc. (currently only in Zen Mode) |
| Low | **i18n** | French, German, Spanish locale files |
| Low | **Photo Rating (1-5★)** | Beyond the binary heart/saved toggle |

### Build & Tooling

| # | Improvement | Why |
|---|-------------|-----|
| 3 | **PostCSS Tailwind** (replace CDN) | `index.html` loads `cdn.tailwindcss.com` at runtime (~100 KB). Switching to Vite + PostCSS eliminates the dependency and shrinks the bundle. |
