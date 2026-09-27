/**
 * The scope a node draws in when its parent's transform and visibility do not reach it
 * (`godot/parentSpace.ts`), such as a plain Node or a CanvasItem under a Node3D. Such a node's three
 * object moves to the nearest world root, outside every ancestor group: its viewport's, or its
 * CanvasLayer's, whose canvas a canvas root draws on. Three hides a whole subtree below one
 * invisible object, and Godot does not.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import { spaceFamilyOf, type SpaceFamily } from '../godot/parentSpace.js';
import { isTopLevelItem } from './canvasPaintOrder.js';
import { nodeEscapesParent } from './nodeEscapesParent.js';
import { CanvasSpaceProvider } from './canvasRootScope.js';

const WorldRootContext = createContext<THREE.Object3D | null>(null);
WorldRootContext.displayName = 'WorldRootContext';

/** The object the viewport's scene tree hangs from, or `null` outside a dispatcher. */
function useWorldRoot(): THREE.Object3D | null {
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
 * Mounts a world root and publishes it to `children`. An Object3D, not a Group: three takes
 * `groupOrder` from the nearest Group, so this resets no canvas key. It exists from the first
 * render, so a node that escapes has somewhere to go at once. `NodeDispatcher` and each CanvasLayer
 * mount it before their children, with no transform of its own, so three updates it first.
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
 * Wraps a node's whole render, moving it to the world root when it escapes its parent. A node that
 * nests normally gets no wrapper. Outside a dispatcher there is no world root, and the node stays
 * where it is.
 */
export function ParentSpaceScope({ node, children }: { node: TscnNode; children: ReactNode }) {
  const escapes = nodeEscapesParent(node, useParentSpaceFamily());
  const worldRoot = useWorldRoot();
  if (!escapes || !worldRoot) return <>{children}</>;
  // No ancestor CanvasItem transform reaches the world root, so the CanvasSpace a canvas root
  // inside inverts is empty.
  return (
    <WorldRootAttached worldRoot={worldRoot}>
      <CanvasSpaceProvider value={null}>{children}</CanvasSpaceProvider>
    </WorldRootAttached>
  );
}

/**
 * Moves only the three object, not the React subtree: an R3F portal would hand every component
 * inside its own `scene`, which WorldEnvironment, Decal and the light helpers write to. R3F calls a
 * function `attach` on every mount and reorder, and its cleanup on removal. An `object3D`, not a
 * group, so no canvas key resets. The key remounts it into a new world root.
 */
function WorldRootAttached({ worldRoot, children }: { worldRoot: THREE.Object3D; children: ReactNode }) {
  const attachToWorldRoot = (_parent: unknown, self: THREE.Object3D) => {
    worldRoot.add(self);
    return () => worldRoot.remove(self);
  };
  return (
    <object3D key={worldRoot.uuid} attach={attachToWorldRoot}>
      {children}
    </object3D>
  );
}

/**
 * An object whose world matrix composes from `space`, not from its parent, as a `top_level`
 * Node3D's does (`node_3d.cpp:656-660`). It stays in its parent's subtree, where visibility still
 * reaches it (`:1132-1143`). `space` is the world root, which three updates first.
 */
class SpaceAnchoredObject extends THREE.Object3D {
  constructor(private readonly space: THREE.Object3D) {
    super();
  }

  override updateMatrixWorld(_force?: boolean): void {
    this.composeFromSpace();
    this.matrixWorldNeedsUpdate = false;
    for (const child of this.children) child.updateMatrixWorld(true);
  }

  override updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void {
    if (updateParents) this.space.updateWorldMatrix(true, false);
    this.composeFromSpace();
    if (updateChildren) for (const child of this.children) child.updateWorldMatrix(false, true);
  }

  private composeFromSpace(): void {
    if (this.matrixAutoUpdate) this.updateMatrix();
    this.matrixWorld.multiplyMatrices(this.space.matrixWorld, this.matrix);
  }
}

/** An element, not a `<primitive>`: R3F builds it from `args`, so it takes children like any group. */
const SpaceAnchored = extend(SpaceAnchoredObject);

/** Wraps a `top_level` Node3D's content so its parent's transform stops reaching it. */
export function TopLevelScope({ node, children }: { node: TscnNode; children: ReactNode }) {
  const worldRoot = useWorldRoot();
  const isTopLevel = isTopLevelItem(node) && spaceFamilyOf(node.type) === 'Node3D';
  if (!isTopLevel || !worldRoot) return <>{children}</>;
  return <SpaceAnchored args={[worldRoot]}>{children}</SpaceAnchored>;
}
