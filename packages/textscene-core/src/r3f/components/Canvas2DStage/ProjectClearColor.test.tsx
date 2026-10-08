/** The project clear colour under the 2D world, over the game viewport rect (`renderer_viewport.cpp:371`). */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ProjectClearColor } from './ProjectClearColor';

async function clearQuad() {
  const renderer = await ReactThreeTestRenderer.create(<ProjectClearColor />);
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

describe('<ProjectClearColor>', () => {
  it("covers Godot's default 1152x648 viewport from the canvas origin down", async () => {
    const quad = await clearQuad();
    const { parameters } = quad.geometry as THREE.PlaneGeometry;
    expect([parameters.width, parameters.height]).toEqual([1152, 648]);
    expect([quad.position.x, quad.position.y]).toEqual([576, -324]);
  });

  it("paints Godot's default sRGB 0.3 grey, opaque", async () => {
    const material = (await clearQuad()).material as THREE.MeshBasicMaterial;
    expect(material.color.getStyle(THREE.SRGBColorSpace)).toBe('rgb(77,77,77)');
    expect(material.transparent).toBe(false);
  });

  it('draws below every canvas key', async () => {
    expect((await clearQuad()).renderOrder).toBeLessThan(0);
  });
});
