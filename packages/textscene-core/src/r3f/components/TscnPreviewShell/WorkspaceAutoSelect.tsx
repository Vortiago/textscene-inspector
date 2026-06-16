/**
 * Selects the viewport workspace from the scene root's node type whenever the
 * parsed scene changes — Godot-editor parity (ADR-0006 amendment): a
 * CanvasItem root opens the 2D workspace, a Node3D root the 3D one, and a
 * plain Node root claims neither, leaving the current workspace alone. Runs
 * per `sceneGraph` identity, so a manual toggle holds until the next scene
 * switch (the same feel as Godot re-running its plugin `handles()` rule per
 * scene tab). Lives inside `<ViewportModeProvider>`; renders no DOM.
 */
import { useEffect } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useViewportMode } from '../../contexts/ViewportModeContext.js';
import { workspaceForRoot } from '../../workspaceForScene.js';

export function WorkspaceAutoSelect({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { setMode } = useViewportMode();
  const root = sceneGraph?.scenes.get(sceneGraph.rootScene)?.nodes[0];
  const claimed = workspaceForRoot(root);

  useEffect(() => {
    if (claimed) setMode(claimed);
    // Re-derive ONLY when the parsed scene changes — `claimed` alone would
    // also fire on manual toggles and fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneGraph, setMode]);

  return null;
}
