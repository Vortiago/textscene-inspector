import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { OmniLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { OmniLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { SceneShadowFitter } from '../../../../r3f/SceneShadowFitter';

function makeNode(overrides: Partial<OmniLight3DProperties> = {}): TscnNode {
  const props: OmniLight3DProperties = {
    name: 'Lamp',
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    shadow_enabled: false,
    omni_range: 5,
    omni_attenuation: 2,
    ...overrides,
  };
  return { name: props.name ?? 'Lamp', type: 'OmniLight3D', children: [], properties: props };
}

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** Plays `WebGLRenderer.render`'s part: the scene's `onBeforeRender` runs with the camera first. */
function renderThrough(renderer: Renderer): void {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 100);
  camera.position.set(0, 0, 10);
  camera.updateMatrixWorld();
  const scene = renderer.scene.instance as THREE.Scene;
  scene.updateMatrixWorld();
  const beforeRender = scene.onBeforeRender as (...args: unknown[]) => void;
  beforeRender.call(scene, null, scene, camera, null);
}

describe('<OmniLight3D>', () => {
  it('renders a PointLight', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OmniLight3D node={makeNode()} />);
    expect(renderer.scene.findAllByType('PointLight').length).toBe(1);
  });

  it('keeps shadow_bias in Godot’s world units, for the patched omni lookup', async () => {
    // Godot's default 0.1 is a world radial offset (`light_storage.cpp:973`).
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ shadow_enabled: true })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(light).shadow.bias).toBe(0.1);
  });

  it('renders the cube from Godot’s 0.025 near plane to the range', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ shadow_enabled: true, omni_range: 10 })} />
    );
    const { camera } = instanceAs<THREE.PointLight>(renderer.scene.findByType('PointLight')).shadow;
    expect(camera.near).toBe(0.025);
    expect(camera.far).toBe(10);
  });

  it('maps omni_range to distance', async () => {
    const renderer = await ReactThreeTestRenderer.create(<OmniLight3D node={makeNode({ omni_range: 12 })} />);
    const light = renderer.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(light).distance).toBe(12);
  });

  it('maps omni_attenuation to decay', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ omni_attenuation: 3 })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(light).decay).toBe(3);
  });

  it('applies energy * LIGHT_INTENSITY_SCALE as intensity', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D node={makeNode({ light_energy: 1.5 })} />
    );
    const light = renderer.scene.findByType('PointLight');
    expect(instanceAs<THREE.PointLight>(light).intensity).toBe(1.5 * LIGHT_INTENSITY_SCALE);
  });

  it('places light at the transform origin', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OmniLight3D
        node={makeNode({
          name: 'Pos',
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: { x: 3, y: 4, z: 5 },
          },
        })}
      />
    );
    const light = renderer.scene.findByProps({ name: 'Pos' });
    expect(light.instance.position.x).toBe(3);
    expect(light.instance.position.y).toBe(4);
    expect(light.instance.position.z).toBe(5);
  });
});

/** The light with the scene's fitter, as `<TscnSceneContents>` mounts both. */
function withFitter(node: TscnNode) {
  return (
    <>
      <OmniLight3D node={node} />
      <SceneShadowFitter />
    </>
  );
}

describe('<OmniLight3D> shadow fit', () => {
  it("fits a cube face of half Godot's slot, its kernel and its normal bias before each render", async () => {
    const renderer = await ReactThreeTestRenderer.create(withFitter(makeNode({ shadow_enabled: true })));
    renderThrough(renderer);
    const light = instanceAs<THREE.PointLight>(renderer.scene.findByType('PointLight'));
    expect(light.shadow.mapSize.x).toBe(512);
    // Godot's soft_shadow_scale: shadow_blur 1 times the Soft Low radius of 2.
    expect(light.shadow.radius).toBe(2);
    // The default normal bias of 1, times ten texels of the 1024 slot.
    expect(light.shadow.normalBias).toBeCloseTo(10 / 1024, 12);
  });

  it('widens the kernel with shadow_blur, and the offset with shadow_normal_bias', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      withFitter(makeNode({ shadow_enabled: true, shadow_blur: 3, shadow_normal_bias: 2 }))
    );
    renderThrough(renderer);
    const light = instanceAs<THREE.PointLight>(renderer.scene.findByType('PointLight'));
    expect(light.shadow.radius).toBe(6);
    expect(light.shadow.normalBias).toBeCloseTo(20 / 1024, 12);
  });

  it('leaves the kernel of a light without a shadow alone (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(withFitter(makeNode({ shadow_blur: 3 })));
    renderThrough(renderer);
    expect(instanceAs<THREE.PointLight>(renderer.scene.findByType('PointLight')).shadow.radius).toBe(1);
  });
});
