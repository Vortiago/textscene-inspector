import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { writeSpatialBindings, writeSpatialInstance } from './spatialBindings.js';
import { transpileSpatial } from './transpileSpatial.js';

const UNSHADED = 'shader_type spatial;\nrender_mode unshaded;\nvoid fragment() {\n\tALBEDO = vec3(0.6);\n}\n';

function written() {
  const spatial = transpileSpatial(UNSHADED);
  const camera = new THREE.PerspectiveCamera(75, 2, 0.05, 4000);
  camera.position.set(0, 1, 3);
  const clearColor = new THREE.Color(0.1, 0.2, 0.3);
  writeSpatialBindings(spatial, { camera, width: 128, height: 64, time: 2.5, clearColor });
  const value = (name: string) =>
    (spatial.uniforms.get(`scene_data_block.data.${name}`) as UniformNode<unknown>).value;
  return { spatial, camera, value };
}

describe('writeSpatialBindings', () => {
  it("writes Godot's projection: y flipped, and depth from 1 at the near plane to 0 at the far one", () => {
    const { camera, value } = written();
    const projection = value('projection_matrix') as THREE.Matrix4;
    const near = new THREE.Vector4(0, 0, -camera.near, 1).applyMatrix4(projection);
    const far = new THREE.Vector4(0, 0, -camera.far, 1).applyMatrix4(projection);
    expect(near.z / near.w).toBeCloseTo(1, 6);
    expect(far.z / far.w).toBeCloseTo(0, 6);
    expect(projection.elements[5]).toBeCloseTo(-camera.projectionMatrix.elements[5]!, 12);
  });

  it("writes the camera's transform as rows, with the origin in the last lane", () => {
    const columns = (written().value('inv_view_matrix') as THREE.Matrix4).elements;
    expect([columns[3], columns[7], columns[11]]).toEqual([0, 1, 3]);
    expect(columns.slice(12)).toEqual([0, 0, 0, 0]);
  });

  it('writes the size, the time, and the clear colour as the ambient light', () => {
    const { value } = written();
    expect((value('viewport_size') as THREE.Vector2).toArray()).toEqual([128, 64]);
    expect((value('screen_pixel_size') as THREE.Vector2).toArray()).toEqual([1 / 128, 1 / 64]);
    expect(value('time')).toBe(2.5);
    expect((value('ambient_light_color_energy') as THREE.Vector4).toArray()).toEqual([0.1, 0.2, 0.3, 1]);
  });
});

describe('writeSpatialInstance', () => {
  it("writes the object's transform into the instance buffer", () => {
    const { spatial } = written();
    const object = new THREE.Object3D();
    object.position.set(4, 5, 6);
    writeSpatialInstance(spatial, object);
    const image = spatial.buffers.get('instances')!.texture.image as { data: Uint32Array };
    expect([...new Float32Array(image.data.buffer).slice(0, 12)]).toEqual([
      1, 0, 0, 4, 0, 1, 0, 5, 0, 0, 1, 6,
    ]);
  });
});
