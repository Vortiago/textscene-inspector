/**
 * The scope a node draws in when its parent's transform and visibility do not reach it
 * (`godot/parentSpace.ts`): a plain Node under a Node3D, a CanvasItem under a Node3D, a CanvasLayer
 * under a Node2D. Such a node re-attaches to its viewport's world root, outside every ancestor
 * group, since three hides a whole subtree below one invisible object and Godot does not.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from '@react-three/fiber';
import * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import { escapesParentSpace, type SpaceFamily } from '../godot/parentSpace.js';
import { CanvasSpaceProvider } from './canvasRootScope.js';

const WorldRootContext = createContext<THREE.Object3D | null>(null);
WorldRootContext.displayName = 'WorldRootContext';

/** The object the viewport's scene tree hangs from, or `null` outside a dispatcher. */
export function useWorldRoot(): THREE.Object3D | null {
  return useContext(WorldRootContext);
}

export function WorldRootProvider({
  value,
  children,
}: {
  value: THREE.Object3D;
  children: ReactNode;
}) {
  return <WorldRootContext.Provider value={value}>{children}</WorldRootContext.Provider>;
}

/**
 * Mounts a viewport's world root where it renders and publishes it to `children`. An Object3D, not
 * a Group: three takes `groupOrder` from the nearest Group, so this resets no canvas key. It exists
 * from the first render, so a node that escapes has somewhere to go at once.
 */
export function WorldRoot({ children }: { children: ReactNode }) {
  const [root] = useState(() => new THREE.Object3D());
  return (
    <>
      <primitive object={root} />
      <WorldRootProvider value={root}>{children}</WorldRootProvider>
    </>
  );
}

const ParentSpaceFamilyContext = createContext<SpaceFamily | null>(null);
ParentSpaceFamilyContext.displayName = 'ParentSpaceFamilyContext';

/** The family of the node rendering this subtree, which only that node knows. */
export function useParentSpaceFamily(): SpaceFamily | null {
  return useContext(ParentSpaceFamilyContext);
}

export function ParentSpaceFamilyProvider({
  value,
  children,
}: {
  value: SpaceFamily | null;
  children: ReactNode;
}) {
  return (
    <ParentSpaceFamilyContext.Provider value={value}>{children}</ParentSpaceFamilyContext.Provider>
  );
}

/**
 * Wraps a node's whole render, portalling it to the world root when it escapes its parent. A node
 * that nests normally gets no portal. Outside a dispatcher there is no world root, and the node
 * stays where it is.
 */
export function ParentSpaceScope({ node, children }: { node: TscnNode; children: ReactNode }) {
  const parentFamily = useParentSpaceFamily();
  const worldRoot = useWorldRoot();
  // A type-less `instance=` node parses as `Node` until it merges (ADR-0013). Its class is the
  // sub-scene root's, still unknown here, so it stays with its parent.
  const escapes = !node.instance && escapesParentSpace(parentFamily, node.type);
  if (!escapes || !worldRoot) return <>{children}</>;
  // No ancestor CanvasItem transform reaches the world root, so a canvas root inside cancels nothing.
  return createPortal(<CanvasSpaceProvider value={null}>{children}</CanvasSpaceProvider>, worldRoot);
}
