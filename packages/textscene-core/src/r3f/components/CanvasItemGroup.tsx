/**
 * `<CanvasItemGroup>` — a positioning group INSIDE a canvas item that keeps the
 * item's place in the canvas.
 *
 * Why this exists rather than a plain `<group>`: three decides paint order from
 * `groupOrder` — the `renderOrder` of the NEAREST enclosing `Group`
 * (`WebGLRenderer.js:1838-1840`'s `projectObject`) — before it looks at the
 * drawn object's own `renderOrder`. A canvas item carries its whole draw-order
 * key on its wrapper group (`canvasPaintOrder.ts`), so ANY bare group a slice puts
 * between that wrapper and its meshes resets the key to 0 for everything inside
 * it, and those pixels fall to the very back of the canvas — behind the scene's
 * own background.
 *
 * The failure is silent in every way that matters: no type error, no warning,
 * and unit tests that read `mesh.renderOrder` still pass, because that is the
 * half of the key three consults second. It is only visible in a rendered
 * frame, which is how it was found — every Label's glyphs disappearing behind
 * the backdrop they were drawn over.
 *
 * Slices legitimately need positioning groups (a line of text, a widget's icon,
 * a slider's grabber, a particle container), so the fix is to make the ordinary
 * spelling carry the key: use `<CanvasItemGroup>` and it is handled.
 * `paintGroupConformance.test.ts` fails the build on a bare `<group>` in a
 * slice that draws inside a canvas item, so this cannot rot.
 *
 * Pass `renderOrder` explicitly only to place a group at a DIFFERENT canvas
 * position than the node's own — `ScrollContainer`'s bars, which draw after the
 * node's whole subtree (`subtreeChromeRenderOrder`).
 */
import { createContext, forwardRef, useContext, type ComponentProps, type ReactNode } from 'react';
import type * as THREE from 'three';

/** Exactly what R3F's intrinsic `<group>` accepts. */
type GroupProps = ComponentProps<'group'>;

const CanvasKeyContext = createContext(0);
CanvasKeyContext.displayName = 'CanvasKeyContext';

/**
 * The enclosing canvas item's draw-order key — published by `<CanvasItem2D>`
 * for the 2D world and by `ControlCanvasWalker` for Controls, which are the two
 * places an item's wrapper group is created.
 */
export function useCanvasItemKey(): number {
  return useContext(CanvasKeyContext);
}

export function CanvasItemKeyProvider({ value, children }: { value: number; children: ReactNode }) {
  return <CanvasKeyContext.Provider value={value}>{children}</CanvasKeyContext.Provider>;
}

export const CanvasItemGroup = forwardRef<THREE.Group, GroupProps>(function CanvasItemGroup(
  { renderOrder, ...props },
  ref
) {
  const canvasKey = useCanvasItemKey();
  return <group ref={ref} renderOrder={renderOrder ?? canvasKey} {...props} />;
});
