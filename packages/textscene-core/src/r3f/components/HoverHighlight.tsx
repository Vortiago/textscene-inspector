/**
 * Viewport hover feedback. Sibling of `<SelectionHighlight>` mounted
 * inside `<TscnCanvas>`; reads `hoveredNodePath` + the dispatcher's
 * path → Object3D ref-map from `SelectionContext`. When a tree row is
 * hovered, attaches an orange `THREE.BoxHelper` (color `0xff8800`,
 * matching main's `HelperManager.showHoverEffect`) to the hovered
 * Object3D.
 *
 * `hoveredNodePath` was populated by `TreeNode.tsx` mouseenter/mouseleave
 * but no viewport component consumed it: dead state.
 *
 * Behavior matches main's HelperManager: the hover and selection
 * helpers live under independent keys, so hovering the already-selected
 * node stacks an orange BoxHelper on top of the green one rather than
 * either replacing the other. That's intentional — main shipped this
 * way (`HelperManager.showHoverEffect` does not touch the 'highlight'
 * map; `highlightNode` clears 'hover' first because clicking removes
 * the hover state, but a fresh hover after a click does NOT clear
 * the highlight).
 *
 * Lifecycle delegated to `useSceneHelper`.
 *
 * Renders no DOM. Outside a SelectionProvider (standalone canvas
 * tests) the component is a no-op via `useOptionalSelection`.
 */
import * as THREE from 'three';
import { useHoveredNodePath, useOptionalSelection } from '../contexts/SelectionContext.js';
import { useHelperTickUpdate, useSceneHelper } from '../hooks/useTHREEHelper.js';
import { useResourceLoader } from '../../resources/useResource.js';
import { useLiveTreeVersion } from '../useLiveSceneTree.js';
import { WorldBoxHelper } from './WorldBoxHelper.js';

const HOVER_COLOR = 0xff8800;

export function HoverHighlight() {
  // Hover lives in a ref-based external store, not SelectionContext's
  // React state — this is the ONE component that reads it.
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
