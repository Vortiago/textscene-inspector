/**
 * Viewport selection feedback. Mounts inside `<TscnCanvas>` so it has
 * access to `useThree`'s scene, and reads `selectedNodePath` plus the
 * dispatcher's path → Object3D ref-map from `SelectionContext`. When a
 * node is selected, attaches a green `THREE.BoxHelper` to the scene
 * wrapping the selected node's THREE object. Matches main's
 * `HelperManager.highlightNode` color (`0x00ff00`) so users moving
 * between branches see a consistent affordance.
 *
 * WI-ARCH-3: lifecycle (build/dispose/tick-update/add-remove) delegated
 * to `useSceneHelper`. The factory returns null when nothing is
 * selected; the hook tears down the helper accordingly.
 *
 * Renders no DOM. Mount as a sibling of `<NodeDispatcher>` inside
 * `<Canvas>`. Outside a SelectionProvider (tests that mount the canvas
 * standalone) the component is a no-op.
 */
import * as THREE from 'three';
import { useOptionalSelection } from '../contexts/SelectionContext.js';
import { useHelperTickUpdate, useSceneHelper } from '../hooks/useTHREEHelper.js';
import { useResourceLoader } from '../../resources/useResource.js';
import { useLiveTreeVersion } from '../useLiveSceneTree.js';
import { WorldBoxHelper } from './WorldBoxHelper.js';

const HIGHLIGHT_COLOR = 0x00ff00;

export function SelectionHighlight() {
  const selection = useOptionalSelection();
  const selectedNodePath = selection?.selectedNodePath ?? null;
  const nodeObjectMap = selection?.nodeObjectMap ?? null;
  const tickUpdate = useHelperTickUpdate();
  // With the tick gate closed (static scene), bounds can still change when an
  // async resource lands INSIDE the selected wrapper (a GLB / instanced
  // sub-scene replacing its placeholder). Recreate the helper on those loads
  // so the box tracks the real geometry instead of the placeholder's bounds.
  const resourceVersion = useLiveTreeVersion(useResourceLoader());

  useSceneHelper<THREE.BoxHelper>(
    () => {
      const target =
        selectedNodePath && nodeObjectMap
          ? nodeObjectMap.get(selectedNodePath) ?? null
          : null;
      if (!target) return null;
      const helper = new WorldBoxHelper(target, HIGHLIGHT_COLOR);
      helper.name = 'tscn-selection-highlight';
      return helper;
    },
    [selectedNodePath, nodeObjectMap, resourceVersion],
    { tickUpdate }
  );

  return null;
}
