/**
 * An `UploadRenderer` that keeps three 0.186's texture cache: one GPU storage per
 * source and cache key, shared by every texture bound to it, and freed when the
 * last of them is disposed (`WebGLTextures.initTexture`, `deallocateTexture`). It
 * records which rows each storage holds, so a test can ask what a drawn texture
 * would sample, not only which calls the queue made.
 */
import type * as THREE from 'three';
import { residencyKey } from './gpuResidency';
import type { UploadRenderer } from './TiledUploadQueue';

export interface FakeStorage {
  /** How many times each row was written: 0 for a row never written. */
  writesPerRow: number[];
  usedTimes: number;
  isDeleted: boolean;
}

export function fakeWebGLTextures(): {
  renderer: UploadRenderer;
  /** The storage `texture` is bound to, or undefined before its init or after its dispose. */
  storageOf(texture: THREE.Texture): FakeStorage | undefined;
  /** Every row written, across all storages. */
  rowsCopied(): number;
} {
  const cache = new WeakMap<THREE.Texture['source'], Map<string, FakeStorage>>();
  const bound = new Map<THREE.Texture, FakeStorage>();
  let rowsCopied = 0;

  function release(texture: THREE.Texture): void {
    const storage = bound.get(texture);
    if (!storage) return;
    bound.delete(texture);
    storage.usedTimes -= 1;
    if (storage.usedTimes === 0) storage.isDeleted = true;
  }

  function onDispose(event: { target: THREE.Texture }): void {
    event.target.removeEventListener('dispose', onDispose);
    release(event.target);
  }

  const renderer: UploadRenderer = {
    initTexture: (texture) => {
      if (!bound.has(texture)) texture.addEventListener('dispose', onDispose);
      let byKey = cache.get(texture.source);
      if (!byKey) {
        byKey = new Map();
        cache.set(texture.source, byKey);
      }
      const key = residencyKey(texture);
      let storage = byKey.get(key);
      if (!storage || storage.isDeleted) {
        const { height } = texture.image as { height: number };
        storage = { writesPerRow: new Array<number>(height).fill(0), usedTimes: 0, isDeleted: false };
        byKey.set(key, storage);
      }
      if (bound.get(texture) === storage) return;
      release(texture);
      storage.usedTimes += 1;
      bound.set(texture, storage);
    },
    writeRows: (texture, fromRow, toRow) => {
      const storage = bound.get(texture);
      if (!storage) throw new Error(`rows written into a texture with no storage: ${texture.uuid}`);
      for (let row = fromRow; row < toRow; row += 1) {
        storage.writesPerRow[row] = (storage.writesPerRow[row] ?? 0) + 1;
      }
      rowsCopied += toRow - fromRow;
    },
    generateMipmaps: () => {},
  };
  return { renderer, storageOf: (texture) => bound.get(texture), rowsCopied: () => rowsCopied };
}
