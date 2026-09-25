/**
 * The rects a `SubViewportContainer` forces onto its sub-viewports, by node
 * path: the return leg of ADR-0033's seam. With `stretch` on, Godot's
 * `recalc_force_viewport_sizes` sizes the viewport at `get_size() / stretch_shrink`,
 * and only the container, a DOM box in another reconciler root, knows that rect.
 */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/** The forced rect in viewport pixels, already divided by `stretch_shrink`. */
export interface ViewportRect {
  x: number;
  y: number;
}

/**
 * Publishes the rect at `path` and returns the cleanup. A re-registration
 * transfers ownership, so a superseded cleanup does nothing.
 */
export type RegisterViewportRect = (path: string, rect: ViewportRect) => () => void;

// Separate from the texture registry: the two travel in opposite directions
// with different lifetimes, and a consumer of one must not re-render for the other.
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

/**
 * The rect forced at `path`, or null, which is valid: with `stretch` off Godot
 * returns early, and a sub-viewport with no container has nothing to resize it.
 * Both keep the authored `size`.
 */
export function useViewportRect(path: string | null): ViewportRect | null {
  const rects = useContext(ViewportRectsContext);
  return path === null ? null : rects.get(path) ?? null;
}

export function ViewportRectProvider({ children }: { children: ReactNode }) {
  const [rects, setRects] = useState<ReadonlyMap<string, ViewportRect>>(() => new Map());
  /**
   * The registration that owns each path. The entry cannot say, since the fast
   * path below keeps an equal measurement's original object. A ref, so a
   * transfer of ownership never renders.
   */
  const owners = useRef(new Map<string, object>()).current;

  const registerViewportRect = useCallback<RegisterViewportRect>(
    (path, rect) => {
      // Ownership binds at call time and outside the updater, which must stay
      // pure for StrictMode's double invocation.
      const token = {};
      owners.set(path, token);
      setRects((prev) => {
        // Stable on an unchanged measurement: a ResizeObserver fires every layout
        // pass, and a new Map would re-allocate every render target.
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
