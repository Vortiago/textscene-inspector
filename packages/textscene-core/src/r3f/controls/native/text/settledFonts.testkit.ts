/**
 * A face loader whose loads settle only when a test settles them, each by the bytes it loads: happy-dom
 * has no `FontFace`, and a load that stays pending shows the loading state for as long as a test needs.
 */
import type { FaceLoader, LoadedFace } from './settledFonts';

export interface HandLoader {
  load: FaceLoader;
  /** Settles the load of `bytes` on `face`, then lets the readers it wakes run. */
  settle(bytes: ArrayBuffer, face: LoadedFace): Promise<void>;
}

export function handLoader(): HandLoader {
  const pending = new Map<ArrayBuffer, (face: LoadedFace) => void>();
  return {
    load: (bytes) => new Promise((resolve) => pending.set(bytes, resolve)),
    async settle(bytes, face) {
      const resolve = pending.get(bytes);
      if (!resolve) throw new Error(`expected a pending face load of ${bytes.byteLength} bytes, got none`);
      resolve(face);
      // A macrotask, not `settleFontWork`: a load another test left pending holds the page-wide count.
      await new Promise((done) => setTimeout(done, 0));
    },
  };
}
