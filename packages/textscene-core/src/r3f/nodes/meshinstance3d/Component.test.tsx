import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from '../../../nodes/3d/meshinstance3d/types';

function makeNode(properties: Partial<MeshInstance3DProperties> = {}): TscnNode {
  const props: MeshInstance3DProperties = {
    name: properties.name ?? 'MyMesh',
    surfaceMaterialOverrides: properties.surfaceMaterialOverrides ?? new Map(),
    ...properties,
  };
  return {
    name: props.name,
    type: 'MeshInstance3D',
    children: [],
    properties: props,
  };
}

function meshSubResource(
  type: string,
  id: string,
  data: Record<string, string | undefined> = {}
): TscnInternalResource {
  return {
    id,
    type,
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
  };
}

async function render(
  node: TscnNode,
  internalResources: TscnInternalResource[] = []
) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources}>
      <MeshInstance3D node={node} />
    </SceneResourcesProvider>
  );
}

describe('<MeshInstance3D>', () => {
  describe('placeholder paths', () => {
    it('renders a magenta wireframe placeholder when no mesh property is set', async () => {
      const renderer = await render(makeNode());
      const mesh = renderer.scene.findByType('Mesh');
      expect(mesh.instance.geometry.type).toBe('BoxGeometry');
      const material = mesh.instance.material as { color: { getHex(): number }; wireframe: boolean };
      expect(material.wireframe).toBe(true);
      expect(material.color.getHex()).toBe(0xff00ff);
    });

    it('renders placeholder when mesh reference cannot be resolved', async () => {
      const node = makeNode({ mesh: 'SubResource("MissingId")' });
      const renderer = await render(node, []);
      const mesh = renderer.scene.findByType('Mesh');
      expect(mesh.instance.geometry.type).toBe('BoxGeometry');
      const material = mesh.instance.material as { wireframe: boolean };
      expect(material.wireframe).toBe(true);
    });

    it('renders placeholder for ExtResource (GLB) references — deferred to useResource', async () => {
      const node = makeNode({ mesh: 'ExtResource("1_glb")' });
      const renderer = await render(node, []);
      const mesh = renderer.scene.findByType('Mesh');
      const material = mesh.instance.material as { wireframe: boolean };
      expect(material.wireframe).toBe(true);
    });
  });

  describe('primitive geometries', () => {
    it('renders BoxGeometry from BoxMesh SubResource', async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")' });
      const resource = meshSubResource('BoxMesh', 'Box_1', { size: 'Vector3(2, 3, 4)' });
      const renderer = await render(node, [resource]);
      const mesh = renderer.scene.findByType('Mesh');
      expect(mesh.instance.geometry.type).toBe('BoxGeometry');
      const params = (mesh.instance.geometry as unknown as { parameters: { width: number; height: number; depth: number } }).parameters;
      expect(params.width).toBe(2);
      expect(params.height).toBe(3);
      expect(params.depth).toBe(4);
    });

    it('renders SphereGeometry from SphereMesh SubResource', async () => {
      const node = makeNode({ mesh: 'SubResource("Sphere_1")' });
      const resource = meshSubResource('SphereMesh', 'Sphere_1', { radius: '1.5' });
      const renderer = await render(node, [resource]);
      const geometry = renderer.scene.findByType('Mesh').instance.geometry as unknown as {
        type: string;
        parameters: { radius: number };
      };
      expect(geometry.type).toBe('SphereGeometry');
      expect(geometry.parameters.radius).toBe(1.5);
    });

    it('renders PlaneGeometry from PlaneMesh SubResource', async () => {
      const node = makeNode({ mesh: 'SubResource("Plane_1")' });
      const resource = meshSubResource('PlaneMesh', 'Plane_1', { size: 'Vector2(4, 6)' });
      const renderer = await render(node, [resource]);
      const geometry = renderer.scene.findByType('Mesh').instance.geometry as unknown as {
        type: string;
        parameters: { width: number; height: number };
      };
      expect(geometry.type).toBe('PlaneGeometry');
      expect(geometry.parameters.width).toBe(4);
      expect(geometry.parameters.height).toBe(6);
    });

    it('renders CylinderGeometry from CylinderMesh SubResource', async () => {
      const node = makeNode({ mesh: 'SubResource("Cyl_1")' });
      const resource = meshSubResource('CylinderMesh', 'Cyl_1', {
        top_radius: '0.5',
        bottom_radius: '1.0',
        height: '3.0',
      });
      const renderer = await render(node, [resource]);
      const geometry = renderer.scene.findByType('Mesh').instance.geometry as unknown as {
        type: string;
        parameters: { radiusTop: number; radiusBottom: number; height: number };
      };
      expect(geometry.type).toBe('CylinderGeometry');
      expect(geometry.parameters.radiusTop).toBe(0.5);
      expect(geometry.parameters.radiusBottom).toBe(1.0);
      expect(geometry.parameters.height).toBe(3.0);
    });

    it('renders CapsuleGeometry from CapsuleMesh SubResource (height - 2*radius adjustment)', async () => {
      const node = makeNode({ mesh: 'SubResource("Cap_1")' });
      const resource = meshSubResource('CapsuleMesh', 'Cap_1', {
        radius: '0.5',
        height: '2.0',
      });
      const renderer = await render(node, [resource]);
      const geometry = renderer.scene.findByType('Mesh').instance.geometry as unknown as {
        type: string;
        parameters: { radius: number; height: number };
      };
      expect(geometry.type).toBe('CapsuleGeometry');
      expect(geometry.parameters.radius).toBe(0.5);
      // Godot's 2.0 height minus 2 * 0.5 radius = 1.0 cylinder section.
      expect(geometry.parameters.height).toBe(1.0);
    });

    it('renders TorusGeometry from TorusMesh SubResource', async () => {
      const node = makeNode({ mesh: 'SubResource("Tor_1")' });
      const resource = meshSubResource('TorusMesh', 'Tor_1', {
        inner_radius: '0.5',
        outer_radius: '1.5',
      });
      const renderer = await render(node, [resource]);
      const geometry = renderer.scene.findByType('Mesh').instance.geometry as unknown as {
        type: string;
        parameters: { radius: number; tube: number };
      };
      expect(geometry.type).toBe('TorusGeometry');
      // Center radius = (1.5 + 0.5) / 2 = 1; tube = (1.5 - 0.5) / 2 = 0.5.
      expect(geometry.parameters.radius).toBe(1);
      expect(geometry.parameters.tube).toBe(0.5);
    });

    it('renders CylinderGeometry with 3 radial segments for PrismMesh', async () => {
      const node = makeNode({ mesh: 'SubResource("Pri_1")' });
      const resource = meshSubResource('PrismMesh', 'Pri_1', { size: 'Vector3(2, 2, 2)' });
      const renderer = await render(node, [resource]);
      const geometry = renderer.scene.findByType('Mesh').instance.geometry as unknown as {
        type: string;
        parameters: { radialSegments: number };
      };
      expect(geometry.type).toBe('CylinderGeometry');
      expect(geometry.parameters.radialSegments).toBe(3);
    });
  });

  describe('materials', () => {
    it('applies StandardMaterial3D scalars from material_override', async () => {
      const node = makeNode({
        mesh: 'SubResource("Box_1")',
        materialOverride: 'SubResource("Mat_1")',
      });
      const resources: TscnInternalResource[] = [
        meshSubResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
        meshSubResource('StandardMaterial3D', 'Mat_1', {
          albedo_color: 'Color(1, 0, 0, 1)',
          metallic: '0.4',
          roughness: '0.2',
        }),
      ];
      const renderer = await render(node, resources);
      const material = renderer.scene.findByType('Mesh').instance.material as {
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

    it('marks material transparent when albedo alpha < 1', async () => {
      const node = makeNode({
        mesh: 'SubResource("Box_1")',
        materialOverride: 'SubResource("Mat_glass")',
      });
      const resources: TscnInternalResource[] = [
        meshSubResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
        meshSubResource('StandardMaterial3D', 'Mat_glass', {
          albedo_color: 'Color(0.2, 0.5, 0.9, 0.4)',
        }),
      ];
      const renderer = await render(node, resources);
      const material = renderer.scene.findByType('Mesh').instance.material as {
        opacity: number;
        transparent: boolean;
      };
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeCloseTo(0.4, 5);
    });

    it('falls back to neutral default material when no material reference exists', async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")' });
      const resources: TscnInternalResource[] = [
        meshSubResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      ];
      const renderer = await render(node, resources);
      const material = renderer.scene.findByType('Mesh').instance.material as {
        color: { getHex(): number };
        metalness: number;
        roughness: number;
      };
      expect(material.color.getHex()).toBe(0xcccccc);
      expect(material.metalness).toBeCloseTo(0.3, 5);
      expect(material.roughness).toBeCloseTo(0.7, 5);
    });

    it('prefers surface_material_override[0] over material_override', async () => {
      const surfaceMap = new Map<number, string>();
      surfaceMap.set(0, 'SubResource("Surf_0")');
      const node = makeNode({
        mesh: 'SubResource("Box_1")',
        materialOverride: 'SubResource("OverrideAll")',
        surfaceMaterialOverrides: surfaceMap,
      });
      const resources: TscnInternalResource[] = [
        meshSubResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
        meshSubResource('StandardMaterial3D', 'OverrideAll', { albedo_color: 'Color(1, 0, 0, 1)' }),
        meshSubResource('StandardMaterial3D', 'Surf_0', { albedo_color: 'Color(0, 1, 0, 1)' }),
      ];
      const renderer = await render(node, resources);
      const material = renderer.scene.findByType('Mesh').instance.material as {
        color: { r: number; g: number; b: number };
      };
      expect(material.color.r).toBe(0);
      expect(material.color.g).toBe(1);
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
      const renderer = await render(node, [
        meshSubResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      ]);
      const mesh = renderer.scene.findByType('Mesh');
      expect(mesh.instance.position.x).toBe(5);
      expect(mesh.instance.position.z).toBe(-2);
    });

    it('sets castShadow=true when castShadow=1 (ON)', async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")', castShadow: 1 });
      const renderer = await render(node, [
        meshSubResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      ]);
      expect(renderer.scene.findByType('Mesh').instance.castShadow).toBe(true);
    });

    it('sets castShadow=false when castShadow=0 (OFF)', async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")', castShadow: 0 });
      const renderer = await render(node, [
        meshSubResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      ]);
      expect(renderer.scene.findByType('Mesh').instance.castShadow).toBe(false);
    });

    it('defaults receiveShadow to true', async () => {
      const node = makeNode({ mesh: 'SubResource("Box_1")' });
      const renderer = await render(node, [
        meshSubResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' }),
      ]);
      expect(renderer.scene.findByType('Mesh').instance.receiveShadow).toBe(true);
    });
  });
});
