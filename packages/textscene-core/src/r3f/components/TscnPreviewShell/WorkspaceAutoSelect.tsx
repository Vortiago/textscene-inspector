/**
 * Selects the viewport workspace from the scene root's node type whenever the
 * parsed scene changes — Godot-editor parity (ADR-0006 amendment): a
 * CanvasItem root opens the 2D workspace, a Node3D root the 3D one, and a
 * plain Node root claims neither, leaving the current workspace alone.
 *
 * The root is COLLAPSED through the live scene tree before classifying, so a
 * scene whose ROOT is itself an instance picks the workspace its SUB-scene
 * belongs to (a root-instanced `.glb` model → 3D, a root-instanced Control →
 * 2D) instead of falling through to "keep current". Because that sub-scene
 * loads async after the parse, the claim is re-derived on the live-tree version
 * tick and applied the moment the workspace becomes known. Auto-select fires
 * once per scene; a manual toggle then holds until the next scene switch (the
 * same feel as Godot re-running its plugin `handles()` rule per scene tab).
 * Lives inside `<ViewportModeProvider>`; renders no DOM.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { workspaceForRoot } from '../../workspaceForScene.js';
import { liveTreeContext, useLiveTreeVersion } from '../../useLiveSceneTree.js';
import { collapseLiveNode, rootScope } from '../../liveSceneTree.js';

export function WorkspaceAutoSelect({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { setMode } = useViewportMode();
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(loader);

  const claimed = useMemo(() => {
    const lt = liveTreeContext(sceneGraph, loader);
    const root = lt?.roots[0];
    if (!lt || !root) return null;
    return workspaceForRoot(collapseLiveNode(root, rootScope(lt.ctx), lt.ctx.sceneCache));
    // `version` is an intentional cache-buster: it increments each time a
    // resource finishes loading so the workspace claim re-derives once a
    // root instance's sub-scene lands. The value itself is not read in the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneGraph, loader, version]);

  // Auto-select ONCE per scene, the moment the workspace becomes known (at parse
  // for a typed root, or when a root instance's sub-scene finishes loading).
  // After that, a manual toggle holds until the next scene switch.
  const appliedFor = useRef<SceneGraph | null>(null);
  useEffect(() => {
    if (claimed && appliedFor.current !== sceneGraph) {
      appliedFor.current = sceneGraph;
      setMode(claimed);
    }
  }, [sceneGraph, claimed, setMode]);

  return null;
}
