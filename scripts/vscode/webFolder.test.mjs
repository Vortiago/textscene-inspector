import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFolderPicker, readFolderFiles } from './webFolder.mjs';

const base64 = (text) => Buffer.from(text).toString('base64');

describe('readFolderFiles', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'web-folder-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('maps each file to its base64 bytes by relative path', () => {
    writeFileSync(path.join(dir, 'Main.tscn'), '[gd_scene format=3]');
    expect(readFolderFiles(dir)).toEqual({ 'Main.tscn': base64('[gd_scene format=3]') });
  });

  it('throws when the folder holds no file', () => {
    mkdirSync(path.join(dir, 'empty'));
    expect(() => readFolderFiles(dir)).toThrow(`expected files under ${dir}, found none`);
  });

  it('keys a nested binary file by a slash-separated path', () => {
    mkdirSync(path.join(dir, 'art', 'models'), { recursive: true });
    const bytes = Buffer.from([0, 255, 128, 10]);
    writeFileSync(path.join(dir, 'art', 'models', 'player.glb'), bytes);
    expect(readFolderFiles(dir)).toEqual({ 'art/models/player.glb': bytes.toString('base64') });
  });
});

/** An in-memory `FileSystemDirectoryHandle`, with only the calls the picker makes. */
function fakeDirectory() {
  const entries = new Map();
  return {
    entries,
    async getDirectoryHandle(name, { create }) {
      if (!entries.has(name) && create) entries.set(name, fakeDirectory());
      return entries.get(name);
    },
    async getFileHandle(name, { create }) {
      if (!entries.has(name) && create) {
        const file = { bytes: null };
        file.createWritable = async () => ({
          write: async (bytes) => {
            file.bytes = bytes;
          },
          close: async () => {},
        });
        entries.set(name, file);
      }
      return entries.get(name);
    },
  };
}

describe('installFolderPicker', () => {
  let privateRoot;
  beforeEach(() => {
    privateRoot = fakeDirectory();
    vi.stubGlobal('navigator', { storage: { getDirectory: async () => privateRoot } });
    vi.stubGlobal('atob', (text) => Buffer.from(text, 'base64').toString('latin1'));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a folder that holds the files', async () => {
    const page = {};
    page.top = page;
    vi.stubGlobal('window', page);
    installFolderPicker({ name: 'game', files: { 'Main.tscn': base64('scene') } });

    const folder = await page.showDirectoryPicker();

    expect(folder).toBe(privateRoot.entries.get('game'));
    expect(Buffer.from(folder.entries.get('Main.tscn').bytes).toString()).toBe('scene');
  });

  it('leaves a nested frame without a picker', () => {
    const frame = { top: {} };
    vi.stubGlobal('window', frame);
    installFolderPicker({ name: 'game', files: { 'Main.tscn': base64('scene') } });
    expect(frame.showDirectoryPicker).toBeUndefined();
  });

  it('creates the subfolders of a nested binary file', async () => {
    const page = {};
    page.top = page;
    vi.stubGlobal('window', page);
    const bytes = [0, 255, 128];
    installFolderPicker({ name: 'game', files: { 'art/player.glb': Buffer.from(bytes).toString('base64') } });

    const folder = await page.showDirectoryPicker();

    expect([...folder.entries.get('art').entries.get('player.glb').bytes]).toEqual(bytes);
  });
});
