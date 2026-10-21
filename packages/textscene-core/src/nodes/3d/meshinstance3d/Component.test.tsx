import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { visualLayersOf } from '../../../r3f/visualLayers';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { subResource } from '../../../testing/subResource';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import './index.r3f';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';

const MeshInstance3D = registeredComponent('MeshInstance3D');

function makeNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const props: MeshInstance3DProperties = {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: properties.name ?? 'MyMesh',
    surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
    ...properties,
  };
  return { rawProperties: {}, name: props.name, type: 'MeshInstance3D', children: [], properties: props };
}

async function render(node: TscnNode, internalResources: TscnInternalResource[] = []) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <MeshInstance3D node={node} />
    </SceneResourcesProvider>
  );
}

describe('<MeshInstance3D>', () => {
  describe('placeholder paths', () => {
    it('draws nothing when no mesh property is set, as Godot does', async () => {
      const renderer = await render(makeNode());
      const mesh = findMesh(renderer.scene);
      expect(mesh.geometry.attributes.position).toBeUndefined();
    });

    it('renders placeholder when mesh reference cannot be resolved', async () => {
      const node = makeNode({ mesh: 'SubResource("MissingId")' });
      const renderer = await render(node, []);
      const mesh = findMesh(renderer.scene);
      expect(mesh.geometry.type).toBe('BoxGeometry');
      const material = mesh.material as unknown as { wireframe: boolean };
      expect(material.wireframe).toBe(true);
    });

    it('renders placeholder for ExtResource (GLB) references — deferred to useResource', async () => {
      const node = makeNode({ mesh: 'ExtResource("1_glb")' });
      const renderer = await render(node, []);
      const mesh = findMesh(renderer.scene);
      const material = mesh.material as unknown as { wireframe: boolean };
      expect(material.wireframe).toBe(true);
    });
  });

  describe('materials', () => {
    it('applies StandardMaterial3D scalars from material_override', async () => {
      const node = makeNode({
        mesh: 'SubResource("Box_1")',
        materialOverride: 'SubResource("Mat_1")',
      });
      const resources: TscnInternalResource[] = [
        subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
        subResource('StandardMaterial3D', 'Mat_1', {
          albedo_color: 'Color(1, 0, 0, 1)',
          metallic: '0.4',
          roughness: '0.2',
        }),
      ];
      const renderer = await render(node, resources);
      const material = findMesh(renderer.scene).material as unknown as {
        color: { r: number; g: number; b: number };
        metalness: number;
        roughness: number;
        transparent: boolean;
      };
      expect(material.color.r).toBe(1);
      expect(material.color.g).toBe(0);
      expect(material.color.b).toBe(0);
      expect(material.metalness).toBe(0.4);
      expect(material.roughness).toBe(0.2);
      expect(material.transparent).toBe(false);
    });

    it('marks material transparent for ALPHA transparency mode (alpha drives opacity)', async () => {
      const node = makeNode({
        mesh: 'SubResource("Box_1")',
        materialOverride: 'SubResource("Mat_glass")',
      });
      const resources: TscnInternalResource[] = [
        subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
        subResource('StandardMaterial3D', 'Mat_glass', {
          // Godot: alpha < 1 only renders transparent when transparency != DISABLED.
          transparency: '1',
          albedo_color: 'Color(0.2, 0.5, 0.9, 0.4)',
        }),
      ];
      const renderer = await render(node, resources);
      const material = findMesh(renderer.scene).material as unknown as {
        opacity: number;
        transparent: boolean;
      };
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeCloseTo(0.4, 5);
    });

    it('falls back to Godot’s default material SHADER, not a default StandardMaterial3D', async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")' });
      const resources: TscnInternalResource[] = [
        subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      ];
      const renderer = await render(node, resources);
      const material = findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
      // Godot binds a hardcoded shader for an unmaterialed mesh, `ALBEDO = vec3(0.6);
      // ROUGHNESS = 0.8; METALLIC = 0.2;`, not a default StandardMaterial3D, so it is
      // mid-grey and slightly metallic.
      const linear = material.color.getRGB({ r: 0, g: 0, b: 0 } as THREE.Color, THREE.LinearSRGBColorSpace);
      expect(linear.r).toBeCloseTo(0.6, 5);
      expect(material.metalness).toBe(0.2);
      expect(material.roughness).toBe(0.8);
    });

    it('prefers material_override over surface_material_override[0]', async () => {
      const surfaceMap = new Map<number, string>();
      surfaceMap.set(0, 'SubResource("Surf_0")');
      const node = makeNode({
        mesh: 'SubResource("Box_1")',
        materialOverride: 'SubResource("OverrideAll")',
        surfaceMaterialOverrides: surfaceMap,
      });
      const resources: TscnInternalResource[] = [
        subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
        subResource('StandardMaterial3D', 'OverrideAll', { albedo_color: 'Color(1, 0, 0, 1)' }),
        subResource('StandardMaterial3D', 'Surf_0', { albedo_color: 'Color(0, 1, 0, 1)' }),
      ];
      const renderer = await render(node, resources);
      const material = findMesh(renderer.scene).material as unknown as {
        color: { r: number; g: number; b: number };
      };
      expect(material.color.r).toBe(1);
      expect(material.color.g).toBe(0);
    });
  });

  describe('render layers', () => {
    it("carries the node's layers mask, which a Decal's cull_mask filters on", async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")', layers: 2 });
      const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
      expect(visualLayersOf(renderer.scene.findByType('Mesh').instance)).toBe(2);
    });

    it("reads an absent layers property as Godot's default", async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")' });
      const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
      expect(visualLayersOf(renderer.scene.findByType('Mesh').instance)).toBe(1);
    });

    it('tags the placeholder branch too, so the mask predates any resource load', async () => {
      const renderer = await render(makeNode({ layers: 4 }));
      expect(visualLayersOf(renderer.scene.findByType('Mesh').instance)).toBe(4);
    });
  });

  describe('transform and shadows', () => {
    it('applies position from transform', async () => {
      const node = makeNode({
        name: 'Positioned',
        mesh: 'SubResource("Box_1")',
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 5, y: 0, z: -2 },
        },
      });
      const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
      const mesh = findMesh(renderer.scene);
      expect(mesh.position.x).toBe(5);
      expect(mesh.position.z).toBe(-2);
    });

    it('sets castShadow=true when castShadow=1 (ON)', async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")', castShadow: 1 });
      const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
      expect(findMesh(renderer.scene).castShadow).toBe(true);
    });

    it('sets castShadow=false when castShadow=0 (OFF)', async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")', castShadow: 0 });
      const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
      expect(findMesh(renderer.scene).castShadow).toBe(false);
    });

    it('defaults receiveShadow to true', async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")' });
      const renderer = await render(node, [subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })]);
      expect(findMesh(renderer.scene).receiveShadow).toBe(true);
    });
  });
});
