/**
 * Registry of animation DRIVERS keyed by scene-tree node path. A driver is an
 * AnimationPlayer or GLB animation driver that owns playable clips bound to a
 * THREE object; it publishes `{ object, clips }` here whenever its clips are
 * available (independent of selection — availability, not the transport).
 *
 * The point of indirection is the AnimationTree: it resolves its `anim_player`
 * NodePath to a node path, then looks that path up here to find the object to
 * root its blended mixer on and the clips to play. This unifies the two clip
 * sources — a GLB's ready-made glTF clips and an AnimationPlayer's clips built
 * from text Animation SubResources — behind one path → driver lookup.
 *
 * Two contexts on purpose: the REGISTER function is stable (its identity never
 * changes) so a publishing driver's effect doesn't re-fire — and re-register —
 * every time the map changes; the DRIVERS map is reactive so a consuming
 * AnimationTree re-renders when its target appears. Both hooks are null-safe
 * (like `useOptionalSelection`): no provider → no-op register / always null.
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type * as THREE from 'three';

export interface AnimationDriverEntry {
  /** Object to root a `THREE.AnimationMixer` on; clips bind to its descendants by name. */
  object: THREE.Object3D;
  /** Ready-to-play clips this driver owns. */
  clips: THREE.AnimationClip[];
}

/** Publish a driver at `path`; returns a cleanup that unregisters it. */
export type RegisterDriver = (path: string, entry: AnimationDriverEntry) => () => void;

const NO_OP_REGISTER: RegisterDriver = () => () => {};
const EMPTY_DRIVERS: ReadonlyMap<string, AnimationDriverEntry> = new Map();

const RegisterDriverContext = createContext<RegisterDriver>(NO_OP_REGISTER);
RegisterDriverContext.displayName = 'RegisterDriverContext';

const DriversContext =
  createContext<ReadonlyMap<string, AnimationDriverEntry>>(EMPTY_DRIVERS);
DriversContext.displayName = 'AnimationDriversContext';

/** Stable publisher for drivers (AnimationPlayer / GLB animation driver). */
export function useRegisterDriver(): RegisterDriver {
  return useContext(RegisterDriverContext);
}

/** Reactive lookup for consumers (AnimationTree): the driver at `path`, or null. */
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
        // Only delete if this exact entry is still registered, so a remount
        // that re-registers before the old cleanup fires isn't clobbered.
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
