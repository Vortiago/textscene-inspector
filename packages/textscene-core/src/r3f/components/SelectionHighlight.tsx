/**
 * Viewport selection feedback. Mounts inside `<TscnCanvas>` so it has
 * access to `useThree`'s scene, and reads `selectedNodePath` plus the
 * dispatcher's path → Object3D ref-map from `SelectionContext`. When a
 * node is selected, attaches a green `THREE.BoxHelper` to the scene
 * wrapping the selected node's THREE object. Matches main's
 * `HelperManager.highlightNode` color (`0x00ff00`) so users moving
 * between branches see a consistent affordance.
 *
 * The BoxHelper is recreated when the selection changes (rather than
 * `setFromObject`-mutated) so it picks up the new target's transform
 * tree cleanly. `useFrame` ticks `update()` so the helper follows the
 * target if its parent transform is animated; per-tick `update` is
 * cheap (it only re-reads the cached bounding box).
 *
 * Renders no DOM. Mount as a sibling of `<NodeDispatcher>` inside
 * `<Canvas>`. Outside a SelectionProvider (tests that mount the canvas
 * standalone) the component is a no-op.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useOptionalSelection } from '../contexts/SelectionContext.js';

const HIGHLIGHT_COLOR = 0x00ff00;

export function SelectionHighlight() {
  const selection = useOptionalSelection();
  const scene = useThree((s) => s.scene);
  const helperRef = useRef<THREE.BoxHelper | null>(null);

  const selectedNodePath = selection?.selectedNodePath ?? null;
  const nodeObjectMap = selection?.nodeObjectMap ?? null;

  useEffect(() => {
    const target =
      selectedNodePath && nodeObjectMap ? nodeObjectMap.get(selectedNodePath) ?? null : null;

    // Tear down any previous helper before swapping. Both branches —
    // "selection cleared" and "selection moved to a different node" —
    // need the old helper removed and disposed.
    if (helperRef.current) {
      scene.remove(helperRef.current);
      helperRef.current.dispose();
      helperRef.current = null;
    }

    if (target) {
      const helper = new THREE.BoxHelper(target, HIGHLIGHT_COLOR);
      helper.name = 'tscn-selection-highlight';
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
  }, [selectedNodePath, nodeObjectMap, scene]);

  useFrame(() => {
    helperRef.current?.update();
  });

  return null;
}
