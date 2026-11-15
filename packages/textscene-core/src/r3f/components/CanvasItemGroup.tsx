/**
 * A positioning group inside a canvas item that keeps the item's canvas key and its local origin.
 * three takes `groupOrder` from the nearest `Group` (r187 `WebGLRenderer.js:1881-1883`), so a
 * bare group resets the key to 0 and its pixels fall behind the background, while a
 * `mesh.renderOrder` test passes. `paintGroupConformance.test.ts` rejects a bare group.
 */
import { createContext, forwardRef, useContext, useMemo, type ComponentProps, type ReactNode } from 'react';
import type * as THREE from 'three';
import { VECTOR2_ZERO, type Vector2 } from '../../godot/math/vector';
import { storedReal } from '../../godot/math/real';

/** Exactly what R3F's intrinsic `<group>` accepts. */
type GroupProps = ComponentProps<'group'>;

const CanvasKeyContext = createContext(0);
CanvasKeyContext.displayName = 'CanvasKeyContext';

/** A point in the item's own coordinates, Godot px with +Y down. */
const CanvasOriginContext = createContext<Readonly<Vector2>>(VECTOR2_ZERO);
CanvasOriginContext.displayName = 'CanvasOriginContext';

/**
 * The enclosing canvas item's draw-order key, published where an item's wrapper
 * group is created: `<CanvasItem2D>` for the 2D world, `ControlCanvasWalker` for Controls.
 */
export function useCanvasItemKey(): number {
  return useContext(CanvasKeyContext);
}

/**
 * Where this point of the tree sits in the enclosing item's own coordinates: the sum of the
 * `<CanvasItemGroup>` positions since the item began. Godot floors a glyph's origin in these
 * coordinates (`text_server_adv.cpp:4082-4084`).
 */
export function useCanvasItemOrigin(): Readonly<Vector2> {
  return useContext(CanvasOriginContext);
}

/** Starts a canvas item: publishes its draw-order key, and its own coordinates begin at 0 here. */
export function CanvasItemProvider({ value, children }: { value: number; children: ReactNode }) {
  return (
    <CanvasKeyContext.Provider value={value}>
      <CanvasOriginContext.Provider value={VECTOR2_ZERO}>{children}</CanvasOriginContext.Provider>
    </CanvasKeyContext.Provider>
  );
}

/**
 * The item point a group at `position` moves its children to. Only the translation counts:
 * `ControlCanvasWalker`'s pivot pair rotates and scales, and its two positions cancel. A scaled
 * group around a run would misplace its origin. A number sets every component, as three's
 * `setScalar` does.
 */
function useOriginPast(position: GroupProps['position']): Readonly<Vector2> {
  const origin = useCanvasItemOrigin();
  const [dx, dy] = translationOf(position);
  // Stored as Godot stores a position, in `real_t`: a double sum of tenths can miss a whole pixel.
  const x = storedReal(origin.x + dx);
  const y = storedReal(origin.y - dy);
  // Keyed by the numbers, as a tuple `position` is a new array on every render.
  return useMemo(() => ({ x, y }), [x, y]);
}

function translationOf(position: GroupProps['position']): readonly [number, number] {
  if (position === undefined) return [0, 0];
  if (typeof position === 'number') return [position, position];
  if ('isVector3' in position) return [position.x, position.y];
  return [position[0], position[1]];
}

/**
 * A `<group>` carrying the canvas key. Pass `renderOrder` only for a group at
 * another canvas position, such as `ScrollContainer`'s bars, which draw after the
 * node's whole subtree (`chromeSlot`). That key is then the key of
 * every group inside it.
 */
export const CanvasItemGroup = forwardRef<THREE.Group, GroupProps>(function CanvasItemGroup(
  { renderOrder, children, ...props },
  ref
) {
  const inherited = useCanvasItemKey();
  const canvasKey = renderOrder ?? inherited;
  const origin = useOriginPast(props.position);
  return (
    <group ref={ref} renderOrder={canvasKey} {...props}>
      <CanvasKeyContext.Provider value={canvasKey}>
        <CanvasOriginContext.Provider value={origin}>{children}</CanvasOriginContext.Provider>
      </CanvasKeyContext.Provider>
    </group>
  );
});
