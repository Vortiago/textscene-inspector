/**
 * The mounted Camera3D objects of one canvas, by node path, across every scene it draws: the
 * main scene and each SubViewport's own. A camera preview finds its camera here, and a remount
 * or a removal re-renders the reader.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import type { Camera } from '@react-three/fiber';

class SceneCameraStore {
  private readonly byPath = new Map<string, Camera>();
  private readonly listeners = new Set<() => void>();

  /** Returns the removal, which leaves a newer camera at the same path in place. */
  register(path: string, camera: Camera): () => void {
    this.byPath.set(path, camera);
    this.notify();
    return () => {
      if (this.byPath.get(path) !== camera) return;
      this.byPath.delete(path);
      this.notify();
    };
  }

  get(path: string): Camera | null {
    return this.byPath.get(path) ?? null;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

const SceneCamerasContext = createContext<SceneCameraStore | null>(null);
SceneCamerasContext.displayName = 'SceneCamerasContext';

/** One per canvas. A portal keeps React context, so a SubViewport's cameras register here too. */
export function SceneCamerasProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => new SceneCameraStore(), []);
  return <SceneCamerasContext.Provider value={store}>{children}</SceneCamerasContext.Provider>;
}

/** Registers the camera in `ref` under `path` while it is mounted. Outside a provider it does nothing. */
export function useRegisterSceneCamera(path: string, ref: RefObject<Camera | null>): void {
  const store = useContext(SceneCamerasContext);
  useEffect(() => {
    const camera = ref.current;
    if (!store || !camera) return undefined;
    return store.register(path, camera);
  }, [store, path, ref]);
}

const NO_SUBSCRIPTION = () => () => {};

/** The mounted camera at `path`, or null for no path, no such camera, or no provider. */
export function useSceneCamera(path: string | null): Camera | null {
  const store = useContext(SceneCamerasContext);
  return useSyncExternalStore(store?.subscribe ?? NO_SUBSCRIPTION, () =>
    store && path ? store.get(path) : null
  );
}
