/**
 * A positioning group inside a canvas item that keeps the item's canvas key. three
 * takes `groupOrder` from the nearest `Group` (`WebGLRenderer.js:1838-1840`), so a
 * bare group resets the key to 0 and its pixels fall behind the background, while a
 * `mesh.renderOrder` test passes. `paintGroupConformance.test.ts` rejects a bare group.
 */
import { createContext, forwardRef, useContext, type ComponentProps, type ReactNode } from 'react';
import type * as THREE from 'three';

/** Exactly what R3F's intrinsic `<group>` accepts. */
type GroupProps = ComponentProps<'group'>;

const CanvasKeyContext = createContext(0);
CanvasKeyContext.displayName = 'CanvasKeyContext';

/**
 * The enclosing canvas item's draw-order key, published where an item's wrapper
 * group is created: `<CanvasItem2D>` for the 2D world, `ControlCanvasWalker` for Controls.
 */
export function useCanvasItemKey(): number {
  return useContext(CanvasKeyContext);
}

export function CanvasItemKeyProvider({ value, children }: { value: number; children: ReactNode }) {
  return <CanvasKeyContext.Provider value={value}>{children}</CanvasKeyContext.Provider>;
}

/**
 * A `<group>` carrying the canvas key. Pass `renderOrder` only for a group at
 * another canvas position, such as `ScrollContainer`'s bars, which draw after the
 * node's whole subtree (`subtreeChromeRenderOrder`).
 */
export const CanvasItemGroup = forwardRef<THREE.Group, GroupProps>(function CanvasItemGroup(
  { renderOrder, ...props },
  ref
) {
  const canvasKey = useCanvasItemKey();
  return <group ref={ref} renderOrder={renderOrder ?? canvasKey} {...props} />;
});
