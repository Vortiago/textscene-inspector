import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createDepthPrepassSentinel } from './depthPrepass';
import {
  DRAWN_OPAQUE_PREPASS,
  FADED_OPAQUE_PREPASS,
  opaquePrepassUserData,
  type OpaquePrepass,
} from '../materials/opaquePrepass';
import { DEPTH_PREPASS_OPAQUE_THRESHOLD } from '../../godot/opaquePrepass';
import { cameraLookingAt } from '../testing/threePasses';

interface PrepassDraw {
  object: THREE.Object3D;
  material: THREE.Material;
  group: THREE.GeometryGroup | null;
  elements: number;
}

/** A renderer that records each draw instead of drawing it. */
function recordingRenderer(draws: PrepassDraw[]): THREE.WebGLRenderer {
  return {
    renderBufferDirect(
      _camera: THREE.Camera,
      _scene: THREE.Scene,
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      object: THREE.Object3D,
      group: THREE.GeometryGroup | null
    ) {
      draws.push({ object, material, group, elements: geometry.drawRange.count });
    },
  } as unknown as THREE.WebGLRenderer;
}

function surface(prepass: OpaquePrepass): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ transparent: true, userData: opaquePrepassUserData(prepass) });
}

/** A mesh at the origin, in front of {@link CAMERA}. */
function meshOf(material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  mesh.updateMatrixWorld(true);
  return mesh;
}

const CAMERA = cameraLookingAt({ x: 0, y: 0, z: 5 });
CAMERA.updateProjectionMatrix();

/** The prepass draws a sentinel makes when three draws it in a scene of `objects`. */
function prepassDraws(...objects: THREE.Object3D[]): PrepassDraw[] {
  const sentinel = createDepthPrepassSentinel();
  const scene = new THREE.Scene();
  scene.add(...objects, sentinel);
  scene.updateMatrixWorld(true);
  const draws: PrepassDraw[] = [];
  const args = [recordingRenderer(draws), scene, CAMERA] as unknown as Parameters<
    THREE.Object3D['onBeforeRender']
  >;
  sentinel.onBeforeRender(...args);
  return draws;
}

describe('the depth prepass a sentinel draws', () => {
  it("draws a prepass surface's depth alone, cut at the depth prepass threshold", () => {
    const mesh = meshOf(surface(DRAWN_OPAQUE_PREPASS));
    const [draw] = prepassDraws(mesh);
    expect(draw!.object).toBe(mesh);
    expect(draw!.material).toMatchObject({
      colorWrite: false,
      depthWrite: true,
      alphaTest: DEPTH_PREPASS_OPAQUE_THRESHOLD,
    });
  });

  it("keeps a scissor above the prepass threshold, as Godot's depth draw cuts at both", () => {
    const material = surface(DRAWN_OPAQUE_PREPASS);
    material.alphaTest = 0.995;
    expect(prepassDraws(meshOf(material))[0]!.material.alphaTest).toBe(0.995);
  });

  it('draws only the groups of a mesh whose surfaces draw a prepass', () => {
    const mesh = meshOf([new THREE.MeshBasicMaterial(), surface(DRAWN_OPAQUE_PREPASS)]);
    mesh.geometry.clearGroups();
    mesh.geometry.addGroup(0, 6, 0);
    mesh.geometry.addGroup(6, 6, 1);
    expect(prepassDraws(mesh).map((draw) => draw.group?.materialIndex)).toEqual([1]);
  });

  it('draws nothing for a surface its fade forces into the alpha pass', () => {
    expect(prepassDraws(meshOf(surface(FADED_OPAQUE_PREPASS)))).toEqual([]);
  });

  it('draws nothing for a hidden mesh or a hidden surface', () => {
    const hidden = meshOf(surface(DRAWN_OPAQUE_PREPASS));
    hidden.visible = false;
    const hiddenSurface = surface(DRAWN_OPAQUE_PREPASS);
    hiddenSurface.visible = false;
    expect(prepassDraws(hidden, meshOf(hiddenSurface))).toEqual([]);
  });

  it('draws nothing for a mesh outside the camera layers or its frustum', () => {
    const otherLayer = meshOf(surface(DRAWN_OPAQUE_PREPASS));
    otherLayer.layers.set(5);
    const behind = meshOf(surface(DRAWN_OPAQUE_PREPASS));
    behind.position.set(0, 0, 20);
    behind.updateMatrixWorld(true);
    expect(prepassDraws(otherLayer, behind)).toEqual([]);
  });

  it("draws in the state the mesh's own draw hooks give, and restores it after (edge case)", () => {
    const mesh = meshOf(surface(DRAWN_OPAQUE_PREPASS));
    const count = mesh.geometry.drawRange.count;
    mesh.onBeforeRender = (_r, _s, _c, geometry) => (geometry.drawRange.count = 0);
    mesh.onAfterRender = (_r, _s, _c, geometry) => (geometry.drawRange.count = count);

    const [draw] = prepassDraws(mesh);

    expect(draw!.elements).toBe(0);
    expect(mesh.geometry.drawRange.count).toBe(count);
  });
});

describe('createDepthPrepassSentinel', () => {
  it('sorts before every opaque draw and is never culled, so the prepass precedes the opaque pass', () => {
    const sentinel = createDepthPrepassSentinel();
    expect(sentinel.renderOrder).toBe(Number.MIN_SAFE_INTEGER);
    expect(sentinel.frustumCulled).toBe(false);
  });

  it('takes no pick and leaves no mark of its own (edge case)', () => {
    const sentinel = createDepthPrepassSentinel();
    const hits: THREE.Intersection[] = [];
    sentinel.raycast(new THREE.Raycaster(), hits);
    expect(hits).toEqual([]);
    expect(sentinel.material).toMatchObject({ colorWrite: false, depthWrite: false });
    expect(sentinel.castShadow).toBe(false);
  });
});
