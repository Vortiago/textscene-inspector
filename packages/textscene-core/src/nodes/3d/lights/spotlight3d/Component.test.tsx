import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SpotLight3D } from './Component';
import type { TscnNode } from '../../../../parser/types';
import type { SpotLight3DProperties } from './types';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { instanceAs } from '../../testing/reactThreeTestInstance';
import { SceneShadowFitter } from '../../../../r3f/SceneShadowFitter';

function makeNode(overrides: Partial<SpotLight3DProperties> = {}): TscnNode {
  const props: SpotLight3DProperties = {
    name: 'Torch',
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    shadow_enabled: false,
    spot_range: 10,
    spot_angle: 30,
    spot_attenuation: 1.0,
    spot_angle_attenuation: 1.0,
    ...overrides,
  };
  return { name: props.name ?? 'Torch', type: 'SpotLight3D', children: [], properties: props };
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

describe('<SpotLight3D>', () => {
  it('keeps shadow_bias in Godot’s clip depth, for the patched spot lookup', async () => {
    // 0.03 / 100 * soft_shadow_scale(2) (`light_storage.cpp:971`, `:1024`).
    const renderer = await ReactThreeTestRenderer.create(
      <SpotLight3D node={makeNode({ shadow_enabled: true, spot_range: 5 })} />
    );
    const light = renderer.scene.findByType('SpotLight');
    expect(instanceAs<THREE.SpotLight>(light).shadow.bias).toBeCloseTo(0.0006, 12);
  });

  it('renders the map from Godot’s 0.025 near plane, which the bias needs', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpotLight3D node={makeNode({ shadow_enabled: true, spot_range: 5 })} />
    );
    expect(instanceAs<THREE.SpotLight>(renderer.scene.findByType('SpotLight')).shadow.camera.near).toBe(
      0.025
    );
  });

  it('renders a SpotLight', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SpotLight3D node={makeNode()} />);
    expect(renderer.scene.findAllByType('SpotLight').length).toBe(1);
  });

  it('converts spot_angle from degrees to radians', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SpotLight3D node={makeNode({ spot_angle: 90 })} />);
    const light = renderer.scene.findByType('SpotLight');
    expect(instanceAs<THREE.SpotLight>(light).angle).toBeCloseTo(Math.PI / 2, 5);
  });

  it('maps spot_range to distance', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SpotLight3D node={makeNode({ spot_range: 25 })} />);
    const light = renderer.scene.findByType('SpotLight');
    expect(instanceAs<THREE.SpotLight>(light).distance).toBe(25);
  });

  it('derives penumbra from spot_angle_attenuation (default 1 → 0.5)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SpotLight3D node={makeNode()} />);
    const light = renderer.scene.findByType('SpotLight');
    // penumbra = 1/(spot_angle_attenuation + 1); default attenuation 1 → 0.5.
    expect(instanceAs<THREE.SpotLight>(light).penumbra).toBeCloseTo(0.5, 5);
  });

  it('overrides default penumbra when supplied', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SpotLight3D node={makeNode({ penumbra: 0.5 })} />);
    const light = renderer.scene.findByType('SpotLight');
    expect(instanceAs<THREE.SpotLight>(light).penumbra).toBe(0.5);
  });

  it('applies energy * LIGHT_INTENSITY_SCALE as intensity', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpotLight3D node={makeNode({ light_energy: 2 })} />
    );
    const light = renderer.scene.findByType('SpotLight');
    expect(instanceAs<THREE.SpotLight>(light).intensity).toBe(2 * LIGHT_INTENSITY_SCALE);
  });
});

/** The light with the scene's fitter, as `<TscnSceneContents>` mounts both. */
function withFitter(node: TscnNode) {
  return (
    <>
      <SpotLight3D node={node} />
      <SceneShadowFitter />
    </>
  );
}

describe('<SpotLight3D> shadow fit', () => {
  it("fits Godot's slot, a kernel of soft_shadow_scale texels and the normal bias before each render", async () => {
    const renderer = await ReactThreeTestRenderer.create(withFitter(makeNode({ shadow_enabled: true })));
    renderThrough(renderer);
    const light = instanceAs<THREE.SpotLight>(renderer.scene.findByType('SpotLight'));
    expect(light.shadow.mapSize.x).toBe(1024);
    expect(light.shadow.radius).toBe(2);
    expect(light.shadow.normalBias).toBeCloseTo(10 / 1024, 12);
  });

  it('widens the kernel with shadow_blur, and the offset with shadow_normal_bias', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      withFitter(makeNode({ shadow_enabled: true, shadow_blur: 3, shadow_normal_bias: 0.5 }))
    );
    renderThrough(renderer);
    const light = instanceAs<THREE.SpotLight>(renderer.scene.findByType('SpotLight'));
    expect(light.shadow.radius).toBe(6);
    expect(light.shadow.normalBias).toBeCloseTo(5 / 1024, 12);
  });

  it('leaves the kernel of a light without a shadow alone (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(withFitter(makeNode({ shadow_blur: 3 })));
    renderThrough(renderer);
    expect(instanceAs<THREE.SpotLight>(renderer.scene.findByType('SpotLight')).shadow.radius).toBe(1);
  });
});
