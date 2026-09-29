/**
 * A tiled upload queue for tests: it tiles every texture except one named
 * `small`, and finishes each upload only when the test says so.
 */
import type * as THREE from 'three';
import { createElement, type ReactNode } from 'react';
import { TiledUploadContext, type TiledUploads } from './TiledUploadContext';
import type { TiledUpload } from './TiledUploadQueue';

export interface FakeUpload {
  texture: THREE.Texture;
  finish(uploaded: boolean): void;
  cancelled: boolean;
}

export function fakeTiledUploads() {
  const pending: FakeUpload[] = [];
  const queue: TiledUploads = {
    needsTiling: (texture: THREE.Texture) => texture.name !== 'small',
    enqueue: (texture: THREE.Texture): TiledUpload => {
      let finish: (uploaded: boolean) => void = () => {};
      const done = new Promise<boolean>((resolve) => {
        finish = resolve;
      });
      const entry: FakeUpload = { texture, finish, cancelled: false };
      pending.push(entry);
      return {
        done,
        cancel: () => {
          entry.cancelled = true;
          finish(false);
        },
      };
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(TiledUploadContext.Provider, { value: queue }, children);
  return { pending, wrapper };
}
