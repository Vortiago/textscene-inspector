/**
 * The Camera3D nodes of one canvas, by node path, across every scene it draws: the main scene and
 * each SubViewport's own. A camera preview finds its camera and what it holds here, whichever world
 * holds the camera, and a remount or a removal re-renders the reader.
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
import type { CameraResources } from './environment/worldExposure';

/** One value per node path, with a listener for each change. */
class PathStore<T> {
  private readonly byPath = new Map<string, T>();
  private readonly listeners = new Set<() => void>();

  /** Returns the removal, which leaves a newer value at the same path in place. */
  register(path: string, value: T): () => void {
    this.byPath.set(path, value);
    this.notify();
    return () => {
      if (this.byPath.get(path) !== value) return;
      this.byPath.delete(path);
      this.notify();
    };
  }

  get(path: string): T | null {
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

interface SceneCameras {
  objects: PathStore<Camera>;
  resources: PathStore<CameraResources>;
}

const SceneCamerasContext = createContext<SceneCameras | null>(null);
SceneCamerasContext.displayName = 'SceneCamerasContext';

/** One per canvas. A portal keeps React context, so a SubViewport's cameras register here too. */
export function SceneCamerasProvider({ children }: { children: ReactNode }) {
  const cameras = useMemo<SceneCameras>(() => ({ objects: new PathStore(), resources: new PathStore() }), []);
  return <SceneCamerasContext.Provider value={cameras}>{children}</SceneCamerasContext.Provider>;
}

/** Registers the camera in `ref` under `path` while it is mounted. Outside a provider it does nothing. */
export function useRegisterSceneCamera(path: string, ref: RefObject<Camera | null>): void {
  const objects = useContext(SceneCamerasContext)?.objects;
  useEffect(() => {
    const camera = ref.current;
    if (!objects || !camera) return undefined;
    return objects.register(path, camera);
  }, [objects, path, ref]);
}

/** Registers what the Camera3D at `path` holds. Outside a provider it does nothing. */
export function useRegisterSceneCameraResources(path: string, held: CameraResources): void {
  const resources = useContext(SceneCamerasContext)?.resources;
  useEffect(() => resources?.register(path, held), [resources, path, held]);
}

const NO_SUBSCRIPTION = () => () => {};

function usePathValue<T>(store: PathStore<T> | undefined, path: string | null): T | null {
  return useSyncExternalStore(store?.subscribe ?? NO_SUBSCRIPTION, () =>
    store && path ? store.get(path) : null
  );
}

/** The mounted camera at `path`, or null for no path, no such camera, or no provider. */
export function useSceneCamera(path: string | null): Camera | null {
  return usePathValue(useContext(SceneCamerasContext)?.objects, path);
}

/** What the Camera3D at `path` holds, or null for no path, no such camera, or no provider. */
export function useSceneCameraResources(path: string | null): CameraResources | null {
  return usePathValue(useContext(SceneCamerasContext)?.resources, path);
}
