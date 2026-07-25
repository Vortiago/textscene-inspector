import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneContents } from './TscnCanvas';
import { frameSceneBounds } from './frameSceneBounds';

describe('<TscnSceneContents> (preview lighting)', () => {
  it('mounts the preview sun for a scene that supplies no light of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    expect(renderer.scene.findAllByType('DirectionalLight')).toHaveLength(1);
  });

  it('places it at Godot’s preview angles, casting a shadow', async () => {
    // altitude 60° above the horizon, azimuth 150° — the light TRAVELS
    // (-0.25, -0.866, 0.433), so it sits on the opposite side.
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    const sun = renderer.scene.findByType('DirectionalLight');
    const position = sun.instance.position as THREE.Vector3;

    expect(position.clone().normalize().y).toBeCloseTo(0.866025, 4);
    expect(position.clone().normalize().x).toBeCloseTo(0.25, 4);
    expect(sun.instance.castShadow).toBe(true);
  });

  it('adds no flat ambient light — the preview environment is a sky, not a constant', async () => {
    // Godot's preview environment lights the scene through its sky's radiance.
    // The fixed `ambientLight intensity={0.4}` this replaced was invented.
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    expect(renderer.scene.findAllByType('AmbientLight')).toHaveLength(0);
  });
});

describe('frameSceneBounds — near plane', () => {
  function sceneWithBox(size: number): THREE.Scene {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(size, size, size)));
    return scene;
  }

  function camera(): THREE.PerspectiveCamera {
    return new THREE.PerspectiveCamera(50, 1280 / 800, 0.1, 1000);
  }

  it('keeps the near plane below the framing distance for a microscopic scene', () => {
    // Regression for the Decal `size=0.001` demo: the camera framed the tiny
    // scene at distance ~0.0012 while the near floor stayed 0.01, so the
    // content sat inside the near plane and the viewport rendered black.
    const cam = camera();
    frameSceneBounds(sceneWithBox(0.001), cam, null);
    const distance = cam.position.length(); // bounds centred on the origin
    expect(cam.near).toBeGreaterThan(0);
    expect(cam.near).toBeLessThan(distance);
  });

  it('retains the 0.01 near floor for a normal-sized scene (no regression)', () => {
    const cam = camera();
    frameSceneBounds(sceneWithBox(0.5), cam, null);
    expect(cam.near).toBeCloseTo(0.01, 6);
    expect(cam.near).toBeLessThan(cam.position.length());
  });
});
