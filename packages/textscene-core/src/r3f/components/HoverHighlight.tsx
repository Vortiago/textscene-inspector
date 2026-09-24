/**
 * Viewport hover feedback: an orange `THREE.BoxHelper` (`0xff8800`) on the Object3D
 * of the hovered tree row. It is independent of the selection helper, so a hovered
 * selected node shows both. Renders no DOM, and does nothing outside a SelectionProvider.
 */
import * as THREE from 'three';
import { useHoveredNodePath, useOptionalSelection } from '../contexts/SelectionContext.js';
import { useHelperTickUpdate, useSceneHelper } from '../hooks/useTHREEHelper.js';
import { useResourceLoader } from '../../resources/useResource.js';
import { useLiveTreeVersion } from '../useLiveSceneTree.js';
import { WorldBoxHelper } from './WorldBoxHelper.js';

const HOVER_COLOR = 0xff8800;

export function HoverHighlight() {
  // Hover lives in a ref-based external store, not SelectionContext's React
  // state, and this is the one component that reads it.
  const hoveredNodePath = useHoveredNodePath();
  const selection = useOptionalSelection();
  const nodeObjectMap = selection?.nodeObjectMap ?? null;
  const tickUpdate = useHelperTickUpdate();
  // See SelectionHighlight: refresh the box when an async GLB/sub-scene lands
  // inside the hovered wrapper while the tick gate is closed.
  const resourceVersion = useLiveTreeVersion(useResourceLoader());

  useSceneHelper<THREE.BoxHelper>(
    () => {
      const target =
        hoveredNodePath && nodeObjectMap
          ? nodeObjectMap.get(hoveredNodePath) ?? null
          : null;
      if (!target) return null;
      const helper = new WorldBoxHelper(target, HOVER_COLOR);
      helper.name = 'tscn-hover-highlight';
      return helper;
    },
    [hoveredNodePath, nodeObjectMap, resourceVersion],
    { tickUpdate }
  );

  return null;
}
