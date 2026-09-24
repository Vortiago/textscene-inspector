/**
 * Puts a green `THREE.BoxHelper` around the selected node's object. It mounts
 * inside `<Canvas>` beside `<NodeDispatcher>`, renders no DOM, and does
 * nothing outside a SelectionProvider. `useSceneHelper` owns the lifecycle.
 */
import * as THREE from 'three';
import { useOptionalSelection } from '../contexts/SelectionContext.js';
import { useHelperTickUpdate, useSceneHelper } from '../hooks/useTHREEHelper.js';
import { useResourceLoader } from '../../resources/useResource.js';
import { useLiveTreeVersion } from '../useLiveSceneTree.js';
import { WorldBoxHelper } from './WorldBoxHelper.js';

// The selection colour of the imperative `HelperManager.highlightNode`.
const HIGHLIGHT_COLOR = 0x00ff00;

export function SelectionHighlight() {
  const selection = useOptionalSelection();
  const selectedNodePath = selection?.selectedNodePath ?? null;
  const nodeObjectMap = selection?.nodeObjectMap ?? null;
  const tickUpdate = useHelperTickUpdate();
  // With the tick gate closed, bounds still change when a GLB or sub-scene
  // replaces its placeholder inside the selection. Recreate the helper then.
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
