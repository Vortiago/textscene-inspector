import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { withGodotAttributes } from '../../shaders/spatial/meshAttributes';
import { OTHER_DRAWS_SURFACE } from '../materials/useOneSurfaceStartingMaterial';
import { visualLayersOf } from '../visualLayers';
import { ShadowCastingSetting } from '../../godot/rendering/rendering';
import { applyShadowCasting, shadowCastingEffects } from '../shadowCasting';
import { setVisualLayers } from '../visualLayers';
import { drawPoints, isEmulatedPoints } from './pointSurface';

/** Two triangles of a quad, the first in draw group 0 and the second in draw group 1. */
function twoGroupQuad(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3)
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 1);
  return withGodotAttributes(geometry);
}

const material = new THREE.MeshBasicMaterial();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

/** What `WebGLRenderer.render` calls before it builds the render list. */
function beforeRenderList(): void {
  scene.onBeforeRender({} as THREE.WebGLRenderer, scene, camera, null as never, material, null as never);
}

describe('drawPoints', () => {
  it('leaves a points host to draw its own points, at the native size', () => {
    const host = new THREE.Points(twoGroupQuad());
    expect(drawPoints(host, null, material, 'native', scene)).toBeNull();
    expect(host.children).toEqual([]);
  });

  it('draws a mesh group as points of its own geometry, with the other groups undrawn', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, 1, material, 'native', scene);
    const [points] = host.children as THREE.Points[];
    expect(points!.isPoints).toBe(true);
    expect(points!.geometry).toBe(host.geometry);
    expect(points!.material).toEqual([OTHER_DRAWS_SURFACE, material]);
  });

  it("draws an emulated point for each corner of the group in Godot's order, as Vulkan draws indexed points", () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, 1, material, 'emulated', scene);
    const [points] = host.children as THREE.Mesh<THREE.InstancedBufferGeometry>[];
    expect(isEmulatedPoints(points!)).toBe(true);
    expect([...points!.geometry.getAttribute('point_vertex_attrib').array]).toEqual([0, 3, 2]);
  });

  it("follows the host's shadows, layers and draw order after a live edit", () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, null, material, 'emulated', scene);
    host.castShadow = true;
    host.renderOrder = 5;
    host.frustumCulled = false;
    host.layers.set(2);
    host.userData = { godotLayers: 4 };
    const [points] = host.children;
    expect([points!.castShadow, points!.renderOrder, points!.frustumCulled, points!.layers.mask]).toEqual([
      true,
      5,
      false,
      1 << 2,
    ]);
    expect(visualLayersOf(points!)).toBe(4);
  });

  it("follows the host's draw hooks after a live edit", () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, null, material, 'native', scene);
    const onBeforeShadow = () => {};
    host.onBeforeShadow = onBeforeShadow;
    expect(host.children[0]!.onBeforeShadow).toBe(onBeforeShadow);
  });

  it('draws native points of the mesh the host holds now', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, 1, material, 'native', scene);
    host.geometry = twoGroupQuad();
    expect((host.children[0] as THREE.Points).geometry).toBe(host.geometry);
  });

  it("takes the host's shadows, layers and draw order, and is never picked", () => {
    const host = new THREE.Mesh(twoGroupQuad());
    host.castShadow = true;
    host.renderOrder = 3;
    host.layers.set(4);
    drawPoints(host, null, material, 'emulated', scene);
    const [points] = host.children;
    expect([points!.castShadow, points!.renderOrder, points!.layers.mask]).toEqual([true, 3, 1 << 4]);
    const hits: THREE.Intersection[] = [];
    points!.raycast(new THREE.Raycaster(), hits);
    expect(hits).toEqual([]);
  });

  it('takes the points away on the returned call', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, null, material, 'emulated', scene)!();
    expect(host.children).toEqual([]);
  });
});

describe('the emulated points before the render list', () => {
  it('rebuilds the quads once the surface has a new write', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    const stop = drawPoints(host, null, material, 'emulated', scene)!;
    const [points] = host.children as THREE.Mesh[];
    const before = points!.geometry;
    host.geometry.getAttribute('position').needsUpdate = true;
    beforeRenderList();
    expect(points!.geometry).not.toBe(before);
    stop();
  });

  it('keeps the quads while the surface is unchanged', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    const stop = drawPoints(host, null, material, 'emulated', scene)!;
    beforeRenderList();
    const [points] = host.children as THREE.Mesh[];
    const built = points!.geometry;
    beforeRenderList();
    expect(points!.geometry).toBe(built);
    stop();
  });

  it('rebuilds the quads of every host that shares a changed surface', () => {
    const surface = twoGroupQuad();
    const first = new THREE.Mesh(surface);
    const second = new THREE.Mesh(surface);
    const stops = [first, second].map((host) => drawPoints(host, null, material, 'emulated', scene)!);
    const builds = [first, second].map((host) => (host.children[0] as THREE.Mesh).geometry);
    surface.getAttribute('position').needsUpdate = true;
    beforeRenderList();
    expect([first, second].map((host, i) => (host.children[0] as THREE.Mesh).geometry !== builds[i])).toEqual(
      [true, true]
    );
    for (const stop of stops) stop();
  });

  it('builds the quads of a surface whose position arrives after the attach', () => {
    const host = new THREE.Mesh(new THREE.BufferGeometry());
    const stop = drawPoints(host, null, material, 'emulated', scene)!;
    host.geometry = twoGroupQuad();
    beforeRenderList();
    const [points] = host.children as THREE.Mesh<THREE.InstancedBufferGeometry>[];
    expect(points!.geometry.instanceCount).toBe(6);
    stop();
  });

  it('stops rebuilding on the returned call', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    const stop = drawPoints(host, null, material, 'emulated', scene)!;
    const points = host.children[0] as THREE.Mesh;
    stop();
    const built = points.geometry;
    host.geometry.getAttribute('position').needsUpdate = true;
    beforeRenderList();
    expect(points.geometry).toBe(built);
  });
});

describe('a walk that writes the points child', () => {
  it('writes the shadow casting of the host and its points without a throw', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, null, material, 'emulated', scene);
    const walked = () =>
      host.traverse((object) => applyShadowCasting(object, shadowCastingEffects(ShadowCastingSetting.ON)));
    expect(walked).not.toThrow();
    expect(host.children[0]!.castShadow).toBe(host.castShadow);
  });

  it('sets the visual layers of the host and its points without a throw', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, null, material, 'emulated', scene);
    host.traverse((object) => setVisualLayers(object, 8));
    expect(visualLayersOf(host.children[0]!)).toBe(8);
  });
});
