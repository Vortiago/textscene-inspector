/**
 * Viewport hover feedback. Sibling of `<SelectionHighlight>` mounted
 * inside `<TscnCanvas>`; reads `hoveredNodePath` + the dispatcher's
 * path → Object3D ref-map from `SelectionContext`. When a tree row is
 * hovered, attaches an orange `THREE.BoxHelper` (color `0xff8800`,
 * matching main's `HelperManager.showHoverEffect`) to the hovered
 * Object3D.
 *
 * Closes Gap 9 from docs/UX-FLOW-GAPS.md: `hoveredNodePath` was being
 * populated by `TreeNode.tsx` mouseenter/mouseleave but no viewport
 * component consumed it — dead state.
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
 * Renders no DOM. Outside a SelectionProvider (standalone canvas
 * tests) the component is a no-op via `useOptionalSelection`.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useOptionalSelection } from '../contexts/SelectionContext.js';

const HOVER_COLOR = 0xff8800;

export function HoverHighlight() {
  const selection = useOptionalSelection();
  const scene = useThree((s) => s.scene);
  const helperRef = useRef<THREE.BoxHelper | null>(null);

  const hoveredNodePath = selection?.hoveredNodePath ?? null;
  const nodeObjectMap = selection?.nodeObjectMap ?? null;

  useEffect(() => {
    const target =
      hoveredNodePath && nodeObjectMap ? nodeObjectMap.get(hoveredNodePath) ?? null : null;

    if (helperRef.current) {
      scene.remove(helperRef.current);
      helperRef.current.dispose();
      helperRef.current = null;
    }

    if (target) {
      const helper = new THREE.BoxHelper(target, HOVER_COLOR);
      helper.name = 'tscn-hover-highlight';
      scene.add(helper);
      helperRef.current = helper;
    }

    return () => {
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.dispose();
        helperRef.current = null;
      }
    };
  }, [hoveredNodePath, nodeObjectMap, scene]);

  useFrame(() => {
    helperRef.current?.update();
  });

  return null;
}
