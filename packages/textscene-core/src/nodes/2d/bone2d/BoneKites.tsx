/**
 * The kites of one Bone2D as a single vertex-coloured fill. Godot draws each kite as an outline
 * polygon and then a fill polygon (`skeleton_2d.cpp:241-308`), and the mesh keeps that order. The
 * points follow the drawn bones each render, so a bone an AnimationPlayer moves moves its kite.
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { mutableTransform2D, type MutableTransform2D } from '../../../godot/math/transform2d.js';
import { triangulatePolygon } from '../../../godot/math/triangulate';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { GizmoMesh } from '../../../r3f/components/GizmoMesh';
import { lookupDrawnObjects, type DrawnObjects } from '../../../r3f/drawnObjects';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { useIsSelected } from '../../../r3f/hooks/useIsSelected';
import { canvasTransformInto, writeGodotPointAsThree } from '../../../r3f/node2dTransform';
import { observeSceneCamera } from '../../../r3f/sceneRenderCamera';
import { boneKitesOf, type BoneKite } from './boneKite';
import type { Bone2DProperties } from './types';

const OUTLINE_POINTS = 6;
const FILL_POINTS = 4;
const POINTS_PER_KITE = OUTLINE_POINTS + FILL_POINTS;
/** Ear clipping gives a polygon of n points n - 2 triangles. */
const INDICES_PER_KITE = 3 * (OUTLINE_POINTS - 2 + FILL_POINTS - 2);

/** `editors/2d/bone_color1`, `bone_color2`, `bone_selected_color` and `bone_outline_color` (`editor_settings.cpp:975-979`). */
const FILL_COLORS = [
  { r: 1, g: 1, b: 1, a: 0.7 },
  { r: 0.6, g: 0.6, b: 0.6, a: 0.7 },
];
const SELECTED_OUTLINE_COLOR = { r: 0.9, g: 0.45, b: 0.45, a: 0.7 };
const OUTLINE_COLOR = { r: 0.35, g: 0.35, b: 0.35, a: 0.5 };

type Rgba = { r: number; g: number; b: number; a: number };

function writeColor(out: Float32Array, point: number, color: Rgba): void {
  const linear = godotColorToLinear(color);
  out.set([linear.r, linear.g, linear.b, color.a], point * 4);
}

/** The colour of each point of `kiteCount` kites: the outline in one colour, the fill in two alternating. */
function kiteColors(kiteCount: number, isSelected: boolean): Float32Array {
  const colors = new Float32Array(kiteCount * POINTS_PER_KITE * 4);
  const outline = isSelected ? SELECTED_OUTLINE_COLOR : OUTLINE_COLOR;
  for (let kite = 0; kite < kiteCount; kite++) {
    const first = kite * POINTS_PER_KITE;
    for (let i = 0; i < OUTLINE_POINTS; i++) writeColor(colors, first + i, outline);
    for (let i = 0; i < FILL_POINTS; i++) writeColor(colors, first + OUTLINE_POINTS + i, FILL_COLORS[i % 2]!);
  }
  return colors;
}

function kiteGeometry(kiteCount: number, isSelected: boolean): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(kiteCount * POINTS_PER_KITE * 3), 3)
  );
  geometry.setAttribute('color', new THREE.BufferAttribute(kiteColors(kiteCount, isSelected), 4));
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
    [...outline, ...fill].forEach(({ x, y }, i) =>
      writeGodotPointAsThree(positions.array as Float32Array, (first + i) * 3, x, y)
    );
    const triangles = [
      ...triangulatePolygon(outline).map((i) => first + i),
      ...triangulatePolygon(fill).map((i) => first + OUTLINE_POINTS + i),
    ];
    indices.array.set(triangles, kite * INDICES_PER_KITE);
    indices.array.fill(0, kite * INDICES_PER_KITE + triangles.length, (kite + 1) * INDICES_PER_KITE);
  });
  positions.needsUpdate = true;
  indices.needsUpdate = true;
  geometry.setDrawRange(0, kites.length * INDICES_PER_KITE);
  geometry.computeBoundingSphere();
}

/** The names of the Bone2D children, in order: the bones Godot draws a kite to (`skeleton_2d.cpp:223-228`). */
function boneChildNames(node: TscnNode): string[] {
  return node.children.filter((child) => child.type === 'Bone2D').map((child) => child.name);
}

/** Updates `geometry` each render from the drawn bone at `path` and its children. */
function useKiteFollow(
  geometry: THREE.BufferGeometry,
  path: string | null,
  childPaths: readonly string[],
  { length, bone_angle: angle }: Pick<Bone2DProperties, 'length' | 'bone_angle'>
): void {
  const scene = useThree((state) => state.scene);
  const nodeObjects = useOptionalSelection()?.nodeObjectMap ?? null;
  useEffect(() => {
    if (path === null || !nodeObjects) return;
    const paths = [path, ...childPaths];
    const global = mutableTransform2D();
    const childTransforms: MutableTransform2D[] = childPaths.map(() => mutableTransform2D());
    let drawn: DrawnObjects | null = null;
    return observeSceneCamera(scene, () => {
      drawn = lookupDrawnObjects(nodeObjects, paths, drawn);
      const [bone, ...children] = drawn.objects;
      if (!bone || !children.every((child) => child !== null)) {
        geometry.setDrawRange(0, 0);
        return;
      }
      canvasTransformInto(global, bone);
      const origins = children.map((child, i) => canvasTransformInto(childTransforms[i]!, child!));
      writeKites(
        geometry,
        boneKitesOf(
          global,
          origins.map(({ tx, ty }) => ({ x: tx, y: ty })),
          { length, angle }
        )
      );
    });
  }, [scene, nodeObjects, geometry, path, childPaths, length, angle]);
}

export function BoneKites({ node }: { node: TscnNode }) {
  const props = node.properties as Bone2DProperties;
  const path = useNodePath();
  const isSelected = useIsSelected();
  const childPaths = useMemo(() => boneChildNames(node).map((name) => `${path}/${name}`), [node, path]);
  const geometry = useMemo(
    () => kiteGeometry(Math.max(1, childPaths.length), isSelected),
    [childPaths.length, isSelected]
  );
  // A bone that calculates falls back to its own rotation (`skeleton_2d.cpp:447-448`).
  const angle = props.auto_calculate_length_and_angle ? props.rotation : props.bone_angle;
  useKiteFollow(geometry, path, childPaths, { length: props.length, bone_angle: angle });
  return <GizmoMesh geometry={geometry} color={0xffffff} alpha={1} />;
}
