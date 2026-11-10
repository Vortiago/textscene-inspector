/**
 * The kites of one Bone2D as a single vertex-coloured fill. Godot draws each kite as an outline
 * polygon and then a fill polygon (`skeleton_2d.cpp:241-308`), and the mesh keeps that order. The
 * points follow the drawn bones each render, so a bone an AnimationPlayer moves moves its kite.
 */

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { FLOATS_PER_VERTEX } from '../../../godot/math/vector';
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
import {
  boneKitesOf,
  FILL_POINT_COUNT,
  OUTLINE_POINT_COUNT,
  type BoneKite,
  type BoneReach,
} from './boneKite';
import type { Bone2DProperties } from './types';

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
const SELECTED_OUTLINE_COLOR = vertexColor({ r: 0.9, g: 0.45, b: 0.45, a: 0.7 });
const OUTLINE_COLOR = vertexColor({ r: 0.35, g: 0.35, b: 0.35, a: 0.5 });

/** Writes the colour of every point of every kite: the outline in one colour, the fill in two alternating. */
function writeColors(geometry: THREE.BufferGeometry, isSelected: boolean): void {
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
  const outline = isSelected ? SELECTED_OUTLINE_COLOR : OUTLINE_COLOR;
  const pointCount = colors.count;
  for (let point = 0; point < pointCount; point++) {
    const inKite = point % POINTS_PER_KITE;
    const color = inKite < OUTLINE_POINT_COUNT ? outline : FILL_COLORS[(inKite - OUTLINE_POINT_COUNT) % 2]!;
    colors.array.set(color, point * FLOATS_PER_COLOR);
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

/** The names of the Bone2D children, in order: the bones Godot draws a kite to (`skeleton_2d.cpp:223-228`). */
function boneChildNames(node: TscnNode): string[] {
  return node.children.filter((child) => child.type === 'Bone2D').map((child) => child.name);
}

const TRANSFORM_TERMS = 6;

function storeTerm(out: Float64Array, at: number, term: number): boolean {
  const hasChanged = out[at] !== term;
  out[at] = term;
  return hasChanged;
}

/** Writes the terms of `t` at `at` in `out`, and whether any differed from what was there. Allocates nothing: it runs every render. */
function storeTransform(out: Float64Array, at: number, t: MutableTransform2D): boolean {
  let hasChanged = storeTerm(out, at, t.a);
  hasChanged = storeTerm(out, at + 1, t.b) || hasChanged;
  hasChanged = storeTerm(out, at + 2, t.c) || hasChanged;
  hasChanged = storeTerm(out, at + 3, t.d) || hasChanged;
  hasChanged = storeTerm(out, at + 4, t.tx) || hasChanged;
  return storeTerm(out, at + 5, t.ty) || hasChanged;
}

/**
 * Updates `geometry` each render from the drawn bone at `path` and its children, and only when one
 * of their transforms moved.
 */
function useKiteFollow(
  geometry: THREE.BufferGeometry,
  path: string | null,
  childPaths: readonly string[],
  reach: BoneReach
): void {
  const scene = useThree((state) => state.scene);
  const nodeObjects = useOptionalSelection()?.nodeObjectMap ?? null;
  useEffect(() => {
    if (path === null || !nodeObjects) return;
    const paths = [path, ...childPaths];
    const transforms = paths.map(() => mutableTransform2D());
    const written = new Float64Array(paths.length * TRANSFORM_TERMS).fill(NaN);
    let drawn: DrawnObjects | null = null;
    return observeSceneCamera(scene, () => {
      drawn = lookupDrawnObjects(nodeObjects, paths, drawn);
      const objects = drawn.objects;
      let hasMoved = false;
      for (let i = 0; i < objects.length; i++) {
        const object = objects[i];
        if (!object) {
          geometry.setDrawRange(0, 0);
          written.fill(NaN);
          return;
        }
        canvasTransformInto(transforms[i]!, object);
        hasMoved = storeTransform(written, i * TRANSFORM_TERMS, transforms[i]!) || hasMoved;
      }
      if (!hasMoved) return;
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
  }, [scene, nodeObjects, geometry, path, childPaths, reach]);
}

export function BoneKites({ node }: { node: TscnNode }) {
  const props = node.properties as Bone2DProperties;
  const path = useNodePath();
  const isSelected = useIsSelected();
  const childPaths = useMemo(() => boneChildNames(node).map((name) => `${path}/${name}`), [node, path]);
  // A bone with no Bone2D child still draws one kite, along its own length.
  const kiteCount = Math.max(1, childPaths.length);
  const geometry = useMemo(() => kiteGeometry(kiteCount), [kiteCount]);
  useEffect(() => writeColors(geometry, isSelected), [geometry, isSelected]);
  // A bone that calculates falls back to its own rotation (`skeleton_2d.cpp:447-448`).
  const angle = props.auto_calculate_length_and_angle ? props.rotation : props.bone_angle;
  const reach = useMemo(() => ({ length: props.length, angle }), [props.length, angle]);
  useKiteFollow(geometry, path, childPaths, reach);
  return <GizmoMesh geometry={geometry} color={0xffffff} alpha={1} />;
}
