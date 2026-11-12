/**
 * A surfaced mesh drawer under a GeometryInstance3D base, as a node's own drawer mounts it: the
 * base hands the draws the instance materials, the layers and the shadow hooks.
 */
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import {
  GEOMETRY_INSTANCE_DEFAULTS,
  type GeometryInstance3DProperties,
} from '../../../nodes/3d/geometryinstance3d/types';
import { instanceAs } from '../../../nodes/3d/testing/reactThreeTestInstance';
import { resolveMaterialSource } from '../../materials/materialSource';
import { SceneResourcesProvider, useSceneResources } from '../../SceneResourcesContext';
import { withGeometryInstance } from '../../visibilityRange/geometryInstance';
import type { MeshPart } from '../SurfacedMeshDrawer';

/** The materials a test names by id, each told apart by its albedo. */
export const MATERIALS: TscnInternalResource[] = [
  { id: 'Green', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  { id: 'Blue', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
  { id: 'Yellow', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 1, 0, 1)' } },
  {
    id: 'GreenThenBlue',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 1, 0, 1)', next_pass: 'SubResource("Blue")' },
  },
  {
    id: 'RedThenYellow',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(1, 0, 0, 1)', next_pass: 'SubResource("Yellow")' },
  },
  {
    id: 'GreenThenBlueThenYellow',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 1, 0, 1)', next_pass: 'SubResource("BlueThenYellow")' },
  },
  {
    id: 'BlueThenYellow',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 0, 1, 1)', next_pass: 'SubResource("Yellow")' },
  },
  {
    id: 'ClearRedThenBlue',
    type: 'StandardMaterial3D',
    data: {
      albedo_color: 'Color(1, 0, 0, 0.5)',
      transparency: '1',
      next_pass: 'SubResource("Blue")',
    },
  },
  {
    id: 'OrangeThenMagenta',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(1, 0.5, 0, 1)', next_pass: 'SubResource("MagentaThenOrange")' },
  },
  {
    id: 'MagentaThenOrange',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(1, 0, 1, 1)', next_pass: 'SubResource("OrangeThenMagenta")' },
  },
  {
    id: 'GreenThenStencilReader',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 1, 0, 1)', next_pass: 'SubResource("StencilReaderThenBlue")' },
  },
  {
    id: 'StencilReaderThenBlue',
    type: 'StandardMaterial3D',
    data: {
      stencil_mode: '3',
      stencil_flags: '1',
      stencil_compare: '5',
      albedo_color: 'Color(0, 0, 0, 1)',
      next_pass: 'SubResource("Blue")',
    },
  },
  {
    id: 'GreenThenNothing',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 1, 0, 1)', next_pass: 'SubResource("Absent")' },
  },
];

/** A box whose one surface holds the material `id` names, or Godot's default surface for none. */
export function boxOf(geometry: THREE.BufferGeometry, ...ids: string[]): UnresolvedPart {
  return { geometry, materialIds: ids };
}

/** A part whose materials a test names by id. */
export interface UnresolvedPart {
  geometry: THREE.BufferGeometry;
  materialIds: readonly string[];
}

/** The parts the drawer takes, each id resolved in `MATERIALS`. */
export function useParts(parts: readonly UnresolvedPart[]): MeshPart[] {
  const pools = useSceneResources();
  return parts.map(({ geometry, materialIds }) => ({
    geometry,
    materials: materialIds.map((id) => resolveMaterialSource(`SubResource("${id}")`, pools)),
  }));
}

function instanceNode(properties: Partial<GeometryInstance3DProperties>): TscnNode {
  return {
    rawProperties: {},
    name: 'Leaf',
    type: 'MeshInstance3D',
    children: [],
    properties: { ...GEOMETRY_INSTANCE_DEFAULTS, name: 'Leaf', ...properties },
  };
}

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** Renders `drawer` as the drawer of a GeometryInstance3D with `properties`. */
export async function renderUnderInstance(
  drawer: ReactNode,
  properties: Partial<GeometryInstance3DProperties> = {}
): Promise<Rendered> {
  const Leaf = withGeometryInstance(() => drawer);
  return ReactThreeTestRenderer.create(underMaterials(<Leaf node={instanceNode(properties)} />));
}

/** `element` with `MATERIALS` as the scene's sub-resources. */
export function underMaterials(element: ReactNode) {
  return <SceneResourcesProvider internalResources={MATERIALS}>{element}</SceneResourcesProvider>;
}

/** Every object of `type` the renderer holds, in scene order. */
export function drawn<T extends THREE.Object3D = THREE.Mesh>(renderer: Rendered, type = 'Mesh'): T[] {
  return renderer.scene.findAllByType(type).map((node) => instanceAs<T>(node));
}

/** The albedo of each material `object` draws, as a hex colour. */
export function albedos(object: THREE.Object3D): number[] {
  const { material } = object as THREE.Mesh;
  const held = Array.isArray(material) ? material : [material];
  return held.filter((m) => m.visible).map((m) => (m as THREE.MeshStandardMaterial).color.getHex());
}
