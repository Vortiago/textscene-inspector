/**
 * The kites of one Bone2D as a single vertex-coloured fill. Godot draws each kite as an outline
 * polygon and then a fill polygon (`skeleton_2d.cpp:241-308`), and the mesh keeps that order. The
 * points follow the drawn bones each render, so a bone an AnimationPlayer or a modification of its
 * Skeleton2D moves moves its kite.
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { FLOATS_PER_VERTEX } from '../../../godot/math/vector';
import { mutableTransform2D } from '../../../godot/math/transform2d.js';
import { triangulatePolygon } from '../../../godot/math/triangulate';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { GizmoMesh } from '../../../r3f/components/GizmoMesh';
import { DrawnNodeFollow } from '../../../r3f/drawnNodeFollow';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { useIsSelected } from '../../../r3f/hooks/useIsSelected';
import { canvasTransformInto, writeGodotPointAsThree } from '../../../r3f/node2dTransform';
import { useLiveScenePass } from '../../../r3f/liveScenePass';
import { observeSceneCamera } from '../../../r3f/sceneRenderCamera';
import { skeleton2DPoseAt } from '../skeleton2d/skeletonPoses';
import { bindBoneChildren, type BoneJoint } from './boneChildren';
import { boneKitesOf, FILL_POINT_COUNT, OUTLINE_POINT_COUNT, type BoneKite } from './boneKite';
import { boneReachOf, type BoneReach } from './boneReach';
import type { Bone2DProperties } from './types';

/** A scene stores a meta as `metadata/<name>`, and `has_meta` ignores its value. */
const POSE_OVERRIDE_KEY = 'metadata/_local_pose_override_enabled_';

/** The children of a bone the pass has not reached. */
const NO_CHILDREN: readonly string[] = [];

const POINTS_PER_KITE = OUTLINE_POINT_COUNT + FILL_POINT_COUNT;
/** Ear clipping gives a polygon of n points n - 2 triangles. */
const INDICES_PER_KITE = 3 * (OUTLINE_POINT_COUNT - 2 + FILL_POINT_COUNT - 2);
const FLOATS_PER_COLOR = 4;

type Rgba = { r: number; g: number; b: number; a: number };

/** An editor colour as the linear RGBA of a vertex. */
function vertexColor({ r, g, b, a }: Rgba): number[] {
  const linear = godotColorToLinear({ r, g, b });
  return [linear.r, linear.g, linear.b, a];
}

/** `editors/2d/bone_color1`, `bone_color2`, `bone_selected_color` and `bone_outline_color` (`editor_settings.cpp:975-979`). */
const FILL_COLORS = [
  vertexColor({ r: 1, g: 1, b: 1, a: 0.7 }),
  vertexColor({ r: 0.6, g: 0.6, b: 0.6, a: 0.7 }),
];
const POSE_OVERRIDE_COLOR = vertexColor({ r: 0.9, g: 0.9, b: 0.45, a: 0.7 });
const SELECTED_OUTLINE_COLOR = vertexColor({ r: 0.9, g: 0.45, b: 0.45, a: 0.7 });
const OUTLINE_COLOR = vertexColor({ r: 0.35, g: 0.35, b: 0.35, a: 0.5 });

/** The state that picks the colours of a kite. */
interface KiteLook {
  isSelected: boolean;
  /** The bone carries `_local_pose_override_enabled_`, which Skeleton2D sets while an IK drives it. */
  hasPoseOverride: boolean;
}

/**
 * Writes the colour of every point of every kite: the outline in one colour, the fill in two
 * alternating, or the fill all in the IK colour for a bone with a pose override (`skeleton_2d.cpp:235-241`).
 */
function writeColors(geometry: THREE.BufferGeometry, { isSelected, hasPoseOverride }: KiteLook): void {
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
  const outline = isSelected ? SELECTED_OUTLINE_COLOR : OUTLINE_COLOR;
  const pointCount = colors.count;
  for (let point = 0; point < pointCount; point++) {
    const inKite = point % POINTS_PER_KITE;
    const isOutline = inKite < OUTLINE_POINT_COUNT;
    const fill = hasPoseOverride ? POSE_OVERRIDE_COLOR : FILL_COLORS[(inKite - OUTLINE_POINT_COUNT) % 2];
    colors.array.set(isOutline ? outline : fill!, point * FLOATS_PER_COLOR);
  }
  colors.needsUpdate = true;
}

function kiteGeometry(kiteCount: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array(kiteCount * POINTS_PER_KITE * FLOATS_PER_VERTEX),
      FLOATS_PER_VERTEX
    )
  );
  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(
      new Float32Array(kiteCount * POINTS_PER_KITE * FLOATS_PER_COLOR),
      FLOATS_PER_COLOR
    )
  );
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(kiteCount * INDICES_PER_KITE), 1));
  geometry.setDrawRange(0, 0);
  return geometry;
}

/** Writes `kites` into `geometry` and draws only them. */
function writeKites(geometry: THREE.BufferGeometry, kites: readonly BoneKite[]): void {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const indices = geometry.getIndex()!;
  kites.forEach(({ outline, fill }, kite) => {
    const first = kite * POINTS_PER_KITE;
    const points = [outline, fill];
    let point = first;
    for (const polygon of points) {
      for (const { x, y } of polygon) {
        writeGodotPointAsThree(positions.array as Float32Array, point * FLOATS_PER_VERTEX, x, y);
        point++;
      }
    }
    // A degenerate kite fails triangulation: its triangles stay empty and draw nothing.
    indices.array.fill(0, kite * INDICES_PER_KITE, (kite + 1) * INDICES_PER_KITE);
    let at = kite * INDICES_PER_KITE;
    triangulatePolygon(outline).forEach((i) => (indices.array[at++] = first + i));
    triangulatePolygon(fill).forEach((i) => (indices.array[at++] = first + OUTLINE_POINT_COUNT + i));
  });
  positions.needsUpdate = true;
  indices.needsUpdate = true;
  geometry.setDrawRange(0, kites.length * INDICES_PER_KITE);
  geometry.computeBoundingSphere();
}

/** What a kite draws from, beside the drawn transforms. */
interface KiteSubject {
  reach: BoneReach;
  joint: BoneJoint | null;
  isSelected: boolean;
  /** Whether the scene file stores the meta an IK leaves on a bone. */
  hasStoredPoseOverride: boolean;
}

/**
 * Updates `geometry` each render from the drawn bone at `path` and its children, and only when one
 * of their transforms moved. The fill takes the IK colour while a modification of the skeleton
 * holds the bone, or from the stored meta where the skeleton runs no stack.
 */
function useKiteFollow(
  geometry: THREE.BufferGeometry,
  path: string | null,
  childPaths: readonly string[],
  { reach, joint, isSelected, hasStoredPoseOverride }: KiteSubject
): void {
  const scene = useThree((state) => state.scene);
  const nodeObjects = useOptionalSelection()?.nodeObjectMap ?? null;
  useEffect(() => {
    if (path === null || !nodeObjects) {
      writeColors(geometry, { isSelected, hasPoseOverride: hasStoredPoseOverride });
      return;
    }
    const follow = new DrawnNodeFollow(nodeObjects, [path, ...childPaths]);
    const transforms = [path, ...childPaths].map(() => mutableTransform2D());
    let coloured: boolean | null = null;
    return observeSceneCamera(scene, () => {
      const pose = joint && skeleton2DPoseAt(nodeObjects, joint.skeletonPath);
      const hasPoseOverride = pose?.holds(joint!.index) ?? hasStoredPoseOverride;
      if (hasPoseOverride !== coloured) {
        coloured = hasPoseOverride;
        writeColors(geometry, { isSelected, hasPoseOverride });
      }
      const objects = follow.objects();
      if (!objects) return void geometry.setDrawRange(0, 0);
      if (!follow.hasMoved(objects)) return;
      objects.forEach((object, i) => canvasTransformInto(transforms[i]!, object));
      const [bone, ...children] = transforms;
      writeKites(
        geometry,
        boneKitesOf(
          bone!,
          children.map(({ tx, ty }) => ({ x: tx, y: ty })),
          reach
        )
      );
    });
  }, [scene, nodeObjects, geometry, path, childPaths, reach, joint, isSelected, hasStoredPoseOverride]);
}

export function BoneKites({ node }: { node: TscnNode }) {
  const props = node.properties as Bone2DProperties;
  const path = useNodePath();
  const isSelected = useIsSelected();
  const source = useLiveScenePass(bindBoneChildren, path);
  const childPaths = source?.children ?? NO_CHILDREN;
  // A bone with no Bone2D child still draws one kite, along its own length.
  const kiteCount = Math.max(1, childPaths.length);
  const geometry = useMemo(() => kiteGeometry(kiteCount), [kiteCount]);
  const reach = useMemo(() => boneReachOf(props, null), [props]);
  useKiteFollow(geometry, path, childPaths, {
    reach,
    joint: source?.joint ?? null,
    isSelected,
    hasStoredPoseOverride: POSE_OVERRIDE_KEY in node.rawProperties,
  });
  return <GizmoMesh geometry={geometry} color={0xffffff} alpha={1} order={source?.drawOrder ?? 0} />;
}
