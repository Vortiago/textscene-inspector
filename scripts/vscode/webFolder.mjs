/**
 * A local folder for VS Code for the Web, as vscode.dev opens one: "File: Open Folder"
 * calls `showDirectoryPicker`, and the workbench reads the handle it returns through the
 * File System Access API. Headless Chromium shows no picker, so the page gets one that
 * fills a folder in the origin private file system and returns that real handle.
 */
/* global window */
// `window` appears only inside `installFolderPicker`, which Playwright serialises
// into the page and never runs in this Node process.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Every file under `dir`, base64 by its `/`-separated path relative to `dir`. Base64,
 * since the map crosses into the page as JSON and a scene's folder holds binary files.
 */
export function readFolderFiles(dir) {
  const files = {};
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else {
        files[path.relative(dir, full).split(path.sep).join('/')] = readFileSync(full).toString('base64');
      }
    }
  };
  visit(dir);
  if (Object.keys(files).length === 0) throw new Error(`expected files under ${dir}, found none`);
  return files;
}

/**
 * Replaces the top window's `showDirectoryPicker` with one that writes `files` into the
 * folder `name` of the origin private file system and returns its handle. It references
 * nothing outside itself: `addInitScript` sends only its source to the page.
 */
export function installFolderPicker({ name, files }) {
  if (window.top !== window) return;
  window.showDirectoryPicker = async () => {
    const root = await navigator.storage.getDirectory();
    const folder = await root.getDirectoryHandle(name, { create: true });
    for (const [relativePath, base64] of Object.entries(files)) {
      const segments = relativePath.split('/');
      let directory = folder;
      for (const segment of segments.slice(0, -1)) {
        directory = await directory.getDirectoryHandle(segment, { create: true });
      }
      const file = await directory.getFileHandle(segments[segments.length - 1], { create: true });
      const writable = await file.createWritable();
      await writable.write(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));
      await writable.close();
    }
    return folder;
  };
}
