import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneContents, frameSceneBounds } from './TscnCanvas';

describe('<TscnSceneContents> (default lighting)', () => {
  it('mounts ambient and directional lights', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);

    const ambient = renderer.scene.findAllByType('AmbientLight');
    const directional = renderer.scene.findAllByType('DirectionalLight');

    expect(ambient).toHaveLength(1);
    expect(directional).toHaveLength(1);
  });

  it('positions the directional light at [5, 5, 5]', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);

    const directional = renderer.scene.findByType('DirectionalLight');
    const pos = directional.instance.position;

    expect(pos.x).toBe(5);
    expect(pos.y).toBe(5);
    expect(pos.z).toBe(5);
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
