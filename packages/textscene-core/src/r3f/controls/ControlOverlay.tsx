/**
 * The 2D-UI overlay (ADR-0003): a DOM layer mounted as a sibling of the R3F
 * <Canvas> (never inside it). Fills the viewport region; root Control nodes
 * position themselves against it via anchors/offsets (parent kind 'free').
 *
 * Takes the Control subtree roots directly; the shell decides when to mount it
 * (2D viewport mode) vs the 3D canvas — that wiring + the 2D/3D toggle is P4.
 */

import { useMemo, type CSSProperties } from 'react';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../parser/types';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ControlDispatcher } from './ControlDispatcher';
import { ControlParentProvider } from './ControlParentContext';

const OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

/**
 * Force the previewed root node(s) visible. Godot UI scenes are frequently
 * authored with the root `visible = false` (modal dialogs that scripts toggle
 * on). In a previewer you loaded the scene precisely to SEE it, so the root is
 * shown regardless — mirroring Godot's editor, which renders hidden nodes. A
 * shallow clone keeps the SceneGraph untouched; CHILD visibility is respected,
 * so this is "show what you opened", not "un-hide everything".
 */
function showRoots(nodes: readonly TscnNode[]): readonly TscnNode[] {
  return nodes.map((n) =>
    (n.properties as { visible?: boolean } | undefined)?.visible === false
      ? { ...n, properties: { ...n.properties, visible: true } }
      : n
  );
}

export interface ControlOverlayProps {
  nodes: readonly TscnNode[];
  /**
   * Scene resources, so StyleBox-bearing Controls (Panel, Button, …) can
   * resolve their `theme_override_styles/*` SubResource refs via
   * useSceneResources + resolveStyleBoxCss. Default empty for resource-free
   * subtrees (e.g. plain Label/ColorRect layouts).
   */
  internalResources?: readonly TscnInternalResource[];
  externalResources?: readonly TscnExternalResource[];
}

export function ControlOverlay({
  nodes,
  internalResources = [],
  externalResources = [],
}: ControlOverlayProps) {
  const rootNodes = useMemo(() => showRoots(nodes), [nodes]);
  return (
    <div data-control-overlay="true" style={OVERLAY_STYLE}>
      <SceneResourcesProvider
        internalResources={internalResources}
        externalResources={externalResources}
      >
        <ControlParentProvider kind="free">
          <ControlDispatcher nodes={rootNodes} />
        </ControlParentProvider>
      </SceneResourcesProvider>
    </div>
  );
}
