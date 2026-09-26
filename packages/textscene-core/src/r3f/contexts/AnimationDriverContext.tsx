/**
 * Animation drivers by node path: an AnimationPlayer or a GLB driver publishes
 * its object and clips whenever they are available, whatever the selection.
 * An AnimationTree resolves its `anim_player` here. Without a provider,
 * register does nothing and the lookup gives null.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type * as THREE from 'three';

/** A driver's clips bound to the scene as it stands, ready for a mixer on the entry's object. */
export interface BoundClips {
  clips: THREE.AnimationClip[];
  /** Every object the bound clips move, whose pose a driver restores on stop. */
  targets: THREE.Object3D[];
}

export interface AnimationDriverEntry {
  /** The object a `THREE.AnimationMixer` roots on, an ancestor of every object the clips move. */
  object: THREE.Object3D;
  /** The clips this driver owns, for their names and durations. */
  clips: THREE.AnimationClip[];
  /** Binds the clips to the objects they move now. A mixer calls it once, when it is built. */
  bind: () => BoundClips;
}

/** Publishes a driver at `path` and returns the cleanup. */
export type RegisterDriver = (path: string, entry: AnimationDriverEntry) => () => void;

const NO_OP_REGISTER: RegisterDriver = () => () => {};
const EMPTY_DRIVERS: ReadonlyMap<string, AnimationDriverEntry> = new Map();

const RegisterDriverContext = createContext<RegisterDriver>(NO_OP_REGISTER);
RegisterDriverContext.displayName = 'RegisterDriverContext';

const DriversContext =
  createContext<ReadonlyMap<string, AnimationDriverEntry>>(EMPTY_DRIVERS);
DriversContext.displayName = 'AnimationDriversContext';

/** Stable, so a publishing driver's effect does not re-fire on every map change. */
export function useRegisterDriver(): RegisterDriver {
  return useContext(RegisterDriverContext);
}

/** Reactive, so an AnimationTree re-renders when its target appears. */
export function useAnimationDriver(path: string | null): AnimationDriverEntry | null {
  const drivers = useContext(DriversContext);
  return path === null ? null : drivers.get(path) ?? null;
}

export function AnimationDriverProvider({ children }: { children: ReactNode }) {
  const [drivers, setDrivers] = useState<ReadonlyMap<string, AnimationDriverEntry>>(
    () => new Map()
  );

  const registerDriver = useCallback<RegisterDriver>((path, entry) => {
    setDrivers((prev) => {
      const next = new Map(prev);
      next.set(path, entry);
      return next;
    });
    return () => {
      setDrivers((prev) => {
        // Only this exact entry, so a remount that re-registered first survives.
        if (prev.get(path) !== entry) return prev;
        const next = new Map(prev);
        next.delete(path);
        return next;
      });
    };
  }, []);

  return (
    <RegisterDriverContext.Provider value={registerDriver}>
      <DriversContext.Provider value={drivers}>{children}</DriversContext.Provider>
    </RegisterDriverContext.Provider>
  );
}
