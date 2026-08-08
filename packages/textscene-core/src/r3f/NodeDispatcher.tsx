/**
 * Recursive walker that turns a parsed SceneGraph into a React tree.
 *
 * For each TscnNode in the scene's root list:
 *   1. Look up `nodeComponentRegistry.get(node.type)`.
 *   2. If a component is registered, render it with the node's pre-walked
 *      children passed as `children`.
 *   3. If `node.instance` is set (an `ExtResource("scene_id")` ref), also
 *      asynchronously load the referenced PackedScene and inject its
 *      root nodes as additional children of the instancing node. This is
 *      how Godot's external-scene composition (`integration-three-cubes.tscn`
 *      → `child_cube.tscn`) is rendered.
 *   4. Otherwise render `<GenericNodeFallback>` so unknown types stay
 *      visible in the viewport.
 *
 * The dispatcher itself only renders nodes; it does NOT mount a `<Canvas>`
 * or any context providers — those are owned by `<TscnCanvas>` and
 * `<TscnPreviewShell>` respectively.
 *
 * Event delegation: the WHOLE dispatched tree is wrapped in ONE
 * root `<group>` carrying `useViewportSelection`'s pointer handlers, instead
 * of every node's own wrapper group carrying a copy. R3F treats every
 * object with a registered pointer handler as its own interactive raycast
 * root, so N per-node handlers meant a mesh at depth d was triangle-tested
 * once per ancestor on every pointer move; one delegated root raycasts the
 * subtree exactly once. `resolvePathFromObject` recovers which node owns
 * the hit mesh from the event's `object` by walking ITS OWN THREE parent
 * chain against the reverse `objectPathMap` `<SelectionContext>` builds —
 * see `useViewportSelection`'s doc comment.
 *
 * The walk itself is three mutually recursive components, one per file:
 * `DispatchedNode` picks the branch, `PlainNode` renders a node, and
 * `InstancedNode` resolves a sub-scene and re-enters the walk.
 */

import { useEffect, useMemo } from 'react';
import type { TscnNode } from '../parser/types.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { useViewportSelection } from './hooks/useViewportSelection.js';
import { canvasModulateColor, CanvasModulateContext } from './canvasModulate.js';
import { prefetchCsgModule } from './csg/csgModule.js';
import { DispatchedNode } from './DispatchedNode.js';

export { DispatchedNode } from './DispatchedNode.js';

/** Does this subtree contain anything that needs boolean evaluation? */
function containsCsgShape(node: TscnNode): boolean {
  if (nodeComponentRegistry.isCsgShape(node.type)) return true;
  return node.children.some(containsCsgShape);
}

export interface NodeDispatcherProps {
  /** Root nodes from the active scene (typically `scene.scenes.get(rootScene).nodes`). */
  nodes: readonly TscnNode[];
}

export function NodeDispatcher({ nodes }: NodeDispatcherProps) {
  const { handlers } = useViewportSelection();

  // Start fetching the CSG library the moment we know the scene needs it. CameraFit's
  // last auto-frame retry fires at 1100 ms, so a boolean result that lands after that
  // would be framed out of the opening view. This is the only CSG-aware line in the
  // dispatcher: the evaluation seam itself lives in CsgPrimitive, because PlainNode is
  // the sole caller of registerNodeObject and skipping CSG children here would strip
  // selection from every one of them.
  useEffect(() => {
    if (nodes.some(containsCsgShape)) prefetchCsgModule();
  }, [nodes]);

  const canvasModulate = useMemo(() => canvasModulateColor(nodes), [nodes]);

  return (
    <group
      onPointerDown={handlers.onPointerDown}
      onPointerUp={handlers.onPointerUp}
      onPointerMove={handlers.onPointerMove}
      onPointerOut={handlers.onPointerOut}
    >
      {/* A CanvasModulate tints the CANVAS, not its subtree, so it is published
          on its own context rather than seeded into the inherited modulate:
          each item multiplies it into its OWN pixels once, and an Unshaded item
          skips it entirely, exactly as Godot's base pass does. */}
      <CanvasModulateContext.Provider value={canvasModulate}>
        {nodes.map((node) => (
          <DispatchedNode key={node.name} node={node} path={node.name} />
        ))}
      </CanvasModulateContext.Provider>
    </group>
  );
}
