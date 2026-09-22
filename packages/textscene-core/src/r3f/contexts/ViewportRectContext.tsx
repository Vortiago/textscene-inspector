/**
 * Registry of the rects a `SubViewportContainer` FORCES onto its sub-viewport
 * children, keyed by scene-tree node path — the return leg of ADR-0033's seam.
 *
 * `ViewportTextureRegistry` carries a target from a publisher inside the R3F
 * root to consumers in the DOM overlay. This carries a measurement the other
 * way, and it exists because Godot's own dependency runs that way too:
 *
 *     void SubViewportContainer::_notification(NOTIFICATION_RESIZED) { ... }
 *     void SubViewportContainer::recalc_force_viewport_sizes() {
 *         if (!stretch) return;
 *         c->set_size_force(get_size() / stretch_shrink);
 *     }
 *
 * With `stretch` on, the container's own rect — not the authored `size` — is
 * what the viewport renders at, so the sub-viewport's content lays out against
 * a number only the container knows. In the previewer the container is a DOM
 * box in the Control overlay and the publisher is an R3F component in a
 * different reconciler root, so the rect has to cross that boundary.
 *
 * Deliberately a SEPARATE registry rather than a wider `ViewportTextureEntry`:
 * the two travel in opposite directions and have different lifetimes (a rect
 * exists as soon as the overlay lays out; a target only once the pass has run),
 * and a consumer of one must not re-render because the other changed.
 *
 * **No rect published is a valid state**, not an error: `stretch` off does not
 * resize the viewport at all (Godot returns early), and a sub-viewport with no
 * container has nothing to be resized by. Both fall back to the authored
 * `size`, which is exactly what Godot does for them.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/** The forced rect, in viewport pixels — already divided by `stretch_shrink`. */
export interface ViewportRect {
  x: number;
  y: number;
}

/**
 * Publish the rect at `path`; returns a cleanup that unregisters it.
 * Re-registering the same path transfers ownership: superseded cleanups become
 * no-ops, so a publisher may re-register freely without releasing first.
 */
export type RegisterViewportRect = (path: string, rect: ViewportRect) => () => void;

const NO_OP_REGISTER: RegisterViewportRect = () => () => {};
const EMPTY: ReadonlyMap<string, ViewportRect> = new Map();

const RegisterViewportRectContext = createContext<RegisterViewportRect>(NO_OP_REGISTER);
RegisterViewportRectContext.displayName = 'RegisterViewportRectContext';

const ViewportRectsContext = createContext<ReadonlyMap<string, ViewportRect>>(EMPTY);
ViewportRectsContext.displayName = 'ViewportRectsContext';

/** Stable publisher, for `<SubViewportContainer>`'s surface. */
export function useRegisterViewportRect(): RegisterViewportRect {
  return useContext(RegisterViewportRectContext);
}

/** Reactive lookup: the rect forced at `path`, or null when none is. */
export function useViewportRect(path: string | null): ViewportRect | null {
  const rects = useContext(ViewportRectsContext);
  return path === null ? null : rects.get(path) ?? null;
}

export function ViewportRectProvider({ children }: { children: ReactNode }) {
  const [rects, setRects] = useState<ReadonlyMap<string, ViewportRect>>(() => new Map());
  /**
   * Which registration currently owns each path. The sibling registries
   * identify the owner by the registered entry itself, which cannot work here:
   * the fast path below leaves an equal measurement's ORIGINAL object in the
   * map, so a remount that re-measures the same rect would look like the
   * departing mount and its stale cleanup would delete the live registration.
   * A ref, so transferring ownership never renders.
   */
  const owners = useRef(new Map<string, object>()).current;

  const registerViewportRect = useCallback<RegisterViewportRect>(
    (path, rect) => {
      // Ownership binds at call time and outside the updater, which must stay
      // pure for StrictMode's double invocation.
      const token = {};
      owners.set(path, token);
      setRects((prev) => {
        // Identity-stable on an unchanged measurement: a ResizeObserver fires on
        // every layout pass, and a new Map each time would re-render every
        // consumer and re-allocate every render target.
        const current = prev.get(path);
        if (current && current.x === rect.x && current.y === rect.y) return prev;
        const next = new Map(prev);
        next.set(path, rect);
        return next;
      });
      return () => {
        if (owners.get(path) !== token) return;
        owners.delete(path);
        setRects((prev) => {
          if (!prev.has(path)) return prev;
          const next = new Map(prev);
          next.delete(path);
          return next;
        });
      };
    },
    [owners]
  );

  return (
    <RegisterViewportRectContext.Provider value={registerViewportRect}>
      <ViewportRectsContext.Provider value={rects}>{children}</ViewportRectsContext.Provider>
    </RegisterViewportRectContext.Provider>
  );
}
