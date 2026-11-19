import * as THREE from 'three';
import type { NodeFrame, UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import type { EnvironmentFog } from '../pipeline/environmentFog.js';
import { beforeEachDraw, writeSpatialBindings } from './spatialBindings.js';
import { transpileSpatial } from './transpileSpatial.js';

const UNSHADED = 'shader_type spatial;\nrender_mode unshaded;\nvoid fragment() {\n\tALBEDO = vec3(0.6);\n}\n';

function written(fog?: EnvironmentFog) {
  const spatial = transpileSpatial(UNSHADED);
  const camera = new THREE.PerspectiveCamera(75, 2, 0.05, 4000);
  camera.position.set(0, 1, 3);
  const clearColor = new THREE.Color(0.1, 0.2, 0.3);
  writeSpatialBindings(spatial, { camera, width: 128, height: 64, time: 2.5, clearColor, fog });
  const value = (name: string) =>
    (spatial.uniforms.get(`scene_data_block.data.${name}`) as UniformNode<unknown>).value;
  const specialisation = (name: string) => spatial.specialisations.get(name)!.value;
  return { spatial, camera, value, specialisation };
}

/** A depth fog with no depth end, so it ends at the far plane. */
const DEPTH_FOG: EnvironmentFog = {
  lightColor: new THREE.Color(0.5, 0.25, 1),
  lightEnergy: 2,
  mode: 1,
  density: 0.4,
  height: -1,
  heightDensity: 0.5,
  depthCurve: 1.5,
  depthBegin: 10,
  depthEnd: 0,
  sunScatter: 0,
  skyAffect: 1,
  aerialPerspective: 0.5,
};

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

describe('the fog bindings', () => {
  it('leaves the fog flag and the depth fog off with no fog', () => {
    const { value, specialisation } = written();
    expect((value('flags') as number) & (1 << 4)).toBe(0);
    expect(specialisation('pso_sc_packed_0')).toBe(0);
  });

  it('turns on the fog flag and the depth fog bit for a depth fog', () => {
    const { value, specialisation } = written(DEPTH_FOG);
    expect((value('flags') as number) & (1 << 4)).toBe(1 << 4);
    expect(specialisation('pso_sc_packed_0')).toBe(1 << 6);
  });

  it('emits the stages again for the program of a depth fog', () => {
    const spatial = transpileSpatial(UNSHADED);
    const before = spatial.material.fragmentNode;
    const camera = new THREE.PerspectiveCamera();
    writeSpatialBindings(spatial, {
      camera,
      width: 8,
      height: 8,
      time: 0,
      clearColor: new THREE.Color(),
      fog: DEPTH_FOG,
    });
    expect(spatial.material.fragmentNode).not.toBe(before);
  });

  it('ends a depth fog with no end at the far plane', () => {
    const { value } = written(DEPTH_FOG);
    expect([value('fog_depth_begin'), value('fog_depth_end')]).toEqual([10, 4000]);
  });

  it('writes the light colour times its energy', () => {
    expect((written(DEPTH_FOG).value('fog_light_color') as THREE.Vector3).toArray()).toEqual([1, 0.5, 2]);
  });

  it('writes no aerial perspective, since the scene template binds no sky radiance', () => {
    expect(written(DEPTH_FOG).value('fog_aerial_perspective')).toBe(0);
  });
});

describe('beforeEachDraw', () => {
  /** A spatial shader whose scene the object update of three's node handler writes before each draw. */
  function eachDraw() {
    const spatial = transpileSpatial(UNSHADED);
    const drawnObjects: THREE.Object3D[] = [];
    beforeEachDraw(spatial, (camera, object) => {
      drawnObjects.push(object);
      writeSpatialBindings(spatial, {
        camera: camera as THREE.PerspectiveCamera,
        width: 32,
        height: 16,
        time: 1,
        clearColor: new THREE.Color(),
      });
    });
    const uniform = (name: string) => spatial.uniforms.get(`scene_data_block.data.${name}`)!;
    return {
      draw: (camera: THREE.Camera, object: THREE.Object3D = new THREE.Mesh()) =>
        uniform('projection_matrix').update({ camera, object } as NodeFrame),
      value: (name: string) => (uniform(name) as UniformNode<unknown>).value,
      drawnObjects,
    };
  }

  it('writes the scene of the camera a draw renders through', () => {
    const { draw, value } = eachDraw();
    draw(new THREE.PerspectiveCamera(60, 2, 0.5, 90));
    expect([value('z_near'), value('z_far')]).toEqual([0.5, 90]);
    expect((value('viewport_size') as THREE.Vector2).toArray()).toEqual([32, 16]);
  });

  it("writes the next draw's camera over the last one's", () => {
    const { draw, value } = eachDraw();
    draw(new THREE.PerspectiveCamera(60, 2, 0.5, 90));
    draw(new THREE.PerspectiveCamera(60, 2, 2, 40));
    expect([value('z_near'), value('z_far')]).toEqual([2, 40]);
  });

  it('hands on the object the draw renders', () => {
    const { draw, drawnObjects } = eachDraw();
    const mesh = new THREE.Mesh();
    draw(new THREE.PerspectiveCamera(), mesh);
    expect(drawnObjects).toEqual([mesh]);
  });
});

describe('the instance buffer of a transpiled spatial shader', () => {
  /** The object update three's node handler runs on each fetch of the buffer before a draw. */
  const drawn = (object: THREE.Object3D) => {
    const { spatial } = written();
    object.updateMatrixWorld();
    const rows = spatial.buffers.get('instances')!;
    const fetch = (rows as unknown as { node: { update: (frame: NodeFrame) => void } }).node;
    fetch.update({ renderId: 1, object } as NodeFrame);
    return spatial;
  };

  it('writes the transform of the object it is about to draw into the instance buffer', () => {
    const object = new THREE.Mesh();
    object.position.set(4, 5, 6);
    const image = drawn(object).buffers.get('instances')!.texture.image as { data: Uint32Array };
    expect([...new Float32Array(image.data.buffer).slice(0, 12)]).toEqual([
      1, 0, 0, 4, 0, 1, 0, 5, 0, 0, 1, 6,
    ]);
  });

  it('refuses an InstancedMesh by name, as no MultiMesh row is ported', () => {
    const instanced = new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined, 2);
    instanced.name = 'crowd';
    expect(() => drawn(instanced)).toThrow('InstancedMesh crowd');
  });

  it('refuses points by name, as no line or point draw is ported', () => {
    const points = new THREE.Points(new THREE.BufferGeometry());
    points.name = 'stars';
    expect(() => drawn(points)).toThrow('Points stars');
  });
});
