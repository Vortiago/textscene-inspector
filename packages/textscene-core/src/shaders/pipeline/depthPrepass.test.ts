import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createDepthPrepass,
  drawWithOwnDepth,
  ownProgramDraw,
  setPrepassDraw,
  type DepthPrepassOptions,
} from './depthPrepass';

interface RecordedDraw {
  readonly object: THREE.Object3D;
  readonly material: THREE.Material;
  readonly colorWrite: boolean;
  readonly depthWrite: boolean;
  readonly stencilWrite: boolean;
  readonly group: THREE.GeometryGroup | null;
}

/** A renderer on the GPU `gpu` that records each draw instead of drawing it. Null names no GPU. */
function recordingRenderer(draws: RecordedDraw[], gpu: () => string | null): THREE.WebGLRenderer {
  const gl = { RENDERER: 0x1f01, getParameter: gpu };
  return {
    getContext: () => gl,
    renderBufferDirect(
      _camera: THREE.Camera,
      _scene: THREE.Scene,
      _geometry: THREE.BufferGeometry,
      material: THREE.Material,
      object: THREE.Object3D,
      group: THREE.GeometryGroup | null
    ) {
      draws.push({
        object,
        material,
        colorWrite: material.colorWrite,
        depthWrite: material.depthWrite,
        stencilWrite: material.stencilWrite,
        group,
      });
    },
  } as unknown as THREE.WebGLRenderer;
}

/** A mesh at the origin, in front of {@link CAMERA}. */
function meshOf(material: THREE.Material | THREE.Material[]): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  mesh.updateMatrixWorld(true);
  return mesh;
}

const CAMERA = new THREE.PerspectiveCamera();
CAMERA.position.set(0, 0, 5);
CAMERA.updateMatrixWorld(true);
CAMERA.updateProjectionMatrix();

const FORWARD_PLUS: DepthPrepassOptions = { renderingMethod: 'forward_plus' };

const COMPATIBILITY: DepthPrepassOptions = { renderingMethod: 'gl_compatibility' };

/** The scene of `objects` with a prepass on `gpu`, and a call that runs a sentinel as three reaches it. */
function prepassScene(options: DepthPrepassOptions, ...objects: THREE.Object3D[]) {
  return prepassSceneOn('Test GPU', options, ...objects);
}

function prepassSceneOn(
  gpu: string | (() => string | null),
  options: DepthPrepassOptions,
  ...objects: THREE.Object3D[]
) {
  const prepass = createDepthPrepass(options);
  const scene = new THREE.Scene();
  scene.add(...objects, prepass.first, prepass.last);
  scene.updateMatrixWorld(true);
  const draws: RecordedDraw[] = [];
  const renderer = recordingRenderer(draws, typeof gpu === 'string' ? () => gpu : gpu);
  const reach = (sentinel: typeof prepass.first) =>
    sentinel.mesh.onBeforeRender(
      ...([renderer, scene, CAMERA] as unknown as Parameters<THREE.Object3D['onBeforeRender']>)
    );
  return { prepass, draws, reach };
}

function prepassDraws(...objects: THREE.Object3D[]): RecordedDraw[] {
  const { prepass, draws, reach } = prepassScene(FORWARD_PLUS, ...objects);
  reach(prepass.first);
  return draws;
}

describe('createDepthPrepass', () => {
  it('draws an opaque surface with its own program and no colour, then gives the colour back', () => {
    const material = new THREE.MeshBasicMaterial();
    const [draw] = prepassDraws(meshOf(material));
    expect(draw).toMatchObject({ material, colorWrite: false });
    expect(material.colorWrite).toBe(true);
  });

  it('draws no surface of the alpha pass', () => {
    expect(prepassDraws(meshOf(new THREE.MeshBasicMaterial({ transparent: true })))).toEqual([]);
  });

  it('draws no surface that skips the depth test, keeps the farthest depth or refracts', () => {
    const overlay = new THREE.MeshBasicMaterial({ depthTest: false });
    const inverted = new THREE.MeshBasicMaterial({ depthFunc: THREE.GreaterDepth });
    const glass = new THREE.MeshPhysicalMaterial({ transmission: 1 });
    expect(prepassDraws(meshOf(overlay), meshOf(inverted), meshOf(glass))).toEqual([]);
  });

  it('draws no stencil op in the prepass, so the colour pass runs it once', () => {
    const material = new THREE.MeshBasicMaterial({ stencilWrite: true });
    const [draw] = prepassDraws(meshOf(material));
    expect(draw!.stencilWrite).toBe(false);
    expect(material.stencilWrite).toBe(true);
  });

  it('gives the colour pass its own state back on dispose, after a render that never reached the last sentinel', () => {
    const material = new THREE.MeshBasicMaterial();
    const { prepass, reach } = prepassScene(FORWARD_PLUS, meshOf(material));
    reach(prepass.first);
    prepass.dispose();
    expect(material).toMatchObject({ depthFunc: THREE.LessEqualDepth, depthWrite: true });
  });

  it('gives the colour back when a draw throws', () => {
    const material = new THREE.MeshBasicMaterial();
    const mesh = meshOf(material);
    mesh.onBeforeRender = () => {
      throw new Error('a hook of the app');
    };
    expect(() => prepassDraws(mesh)).toThrow('a hook of the app');
    expect(material.colorWrite).toBe(true);
  });

  it('draws a surface again in a render nested inside one whose prepass has changed its depth', () => {
    const material = new THREE.MeshBasicMaterial();
    const outer = prepassScene(FORWARD_PLUS, meshOf(material));
    const inner = prepassScene(FORWARD_PLUS, meshOf(material));
    outer.reach(outer.prepass.first);
    inner.reach(inner.prepass.first);
    expect(inner.draws[0]).toMatchObject({ material, colorWrite: false, depthWrite: true });
    inner.reach(inner.prepass.last);
    expect(material).toMatchObject({ depthFunc: THREE.EqualDepth, depthWrite: false });
    outer.reach(outer.prepass.last);
    expect(material).toMatchObject({ depthFunc: THREE.LessEqualDepth, depthWrite: true });
  });

  it('draws the material its maker set, such as the shared default material', () => {
    const shared = new THREE.MeshBasicMaterial();
    const material = new THREE.MeshBasicMaterial();
    setPrepassDraw(material, { material: shared });
    expect(prepassDraws(meshOf(material))[0]!.material).toBe(shared);
  });

  it('draws nothing for a material its maker kept out of the prepass', () => {
    const material = new THREE.MeshBasicMaterial();
    setPrepassDraw(material, null);
    expect(prepassDraws(meshOf(material))).toEqual([]);
  });

  it('draws an alpha-pass surface whose maker set a draw, and leaves its colour pass as it is', () => {
    const material = new THREE.MeshBasicMaterial({ transparent: true });
    setPrepassDraw(material, { material: new THREE.MeshDepthMaterial({ colorWrite: false }) });
    const { prepass, draws, reach } = prepassScene(FORWARD_PLUS, meshOf(material));
    reach(prepass.first);
    expect(draws).toHaveLength(1);
    expect(material).toMatchObject({ depthFunc: THREE.LessEqualDepth, depthWrite: true });
  });

  it('runs the draw inside the maker’s per-pass setting', () => {
    const material = new THREE.MeshBasicMaterial();
    const drawsSeen: number[] = [];
    const { prepass, draws, reach } = prepassScene(FORWARD_PLUS, meshOf(material));
    setPrepassDraw(material, {
      material,
      around: (draw) => {
        drawsSeen.push(draws.length);
        draw();
        drawsSeen.push(draws.length);
      },
    });
    reach(prepass.first);
    expect(drawsSeen).toEqual([0, 1]);
  });

  it('draws only the groups of a mesh whose surfaces the prepass draws', () => {
    const mesh = meshOf([new THREE.MeshBasicMaterial({ transparent: true }), new THREE.MeshBasicMaterial()]);
    mesh.geometry.clearGroups();
    mesh.geometry.addGroup(0, 6, 0);
    mesh.geometry.addGroup(6, 6, 1);
    expect(prepassDraws(mesh).map((draw) => draw.group?.materialIndex)).toEqual([1]);
  });

  it('draws nothing for a hidden mesh, a hidden surface, another layer or outside the frustum', () => {
    const hidden = meshOf(new THREE.MeshBasicMaterial());
    hidden.visible = false;
    const otherLayer = meshOf(new THREE.MeshBasicMaterial());
    otherLayer.layers.set(5);
    const behind = meshOf(new THREE.MeshBasicMaterial());
    behind.position.set(0, 0, 20);
    behind.updateMatrixWorld(true);
    expect(
      prepassDraws(hidden, meshOf(new THREE.MeshBasicMaterial({ visible: false })), otherLayer, behind)
    ).toEqual([]);
  });

  it('turns the opaque colour pass to the given test with no depth write, until the last sentinel', () => {
    const material = new THREE.MeshBasicMaterial();
    const { prepass, reach } = prepassScene(FORWARD_PLUS, meshOf(material), meshOf(material));
    reach(prepass.first);
    expect(material).toMatchObject({ depthFunc: THREE.EqualDepth, depthWrite: false });
    reach(prepass.last);
    expect(material).toMatchObject({ depthFunc: THREE.LessEqualDepth, depthWrite: true });
  });

  it("lets another pass draw a surface with its own depth state while the prepass's state holds", () => {
    const material = new THREE.MeshBasicMaterial();
    const { prepass, reach } = prepassScene(FORWARD_PLUS, meshOf(material));
    reach(prepass.first);
    const seen: Partial<THREE.Material>[] = [];
    drawWithOwnDepth(material, () =>
      seen.push({ depthFunc: material.depthFunc, depthWrite: material.depthWrite })
    );
    expect(seen).toEqual([{ depthFunc: THREE.LessEqualDepth, depthWrite: true }]);
    expect(material).toMatchObject({ depthFunc: THREE.EqualDepth, depthWrite: false });
  });

  it('runs its draws inside `timed`', () => {
    const steps: number[] = [];
    const { prepass, draws, reach } = prepassScene(
      {
        ...FORWARD_PLUS,
        timed: (_renderer, draw) => (steps.push(draws.length), draw(), steps.push(draws.length)),
      },
      meshOf(new THREE.MeshBasicMaterial())
    );
    reach(prepass.first);
    expect(steps).toEqual([0, 1]);
  });

  it('turns the opaque colour pass to LEQUAL with no depth write on gl_compatibility', () => {
    const material = new THREE.MeshBasicMaterial({ depthFunc: THREE.LessDepth });
    const { prepass, draws, reach } = prepassScene(COMPATIBILITY, meshOf(material));
    reach(prepass.first);
    expect(draws).toHaveLength(1);
    expect(material).toMatchObject({ depthFunc: THREE.LessEqualDepth, depthWrite: false });
  });

  it('draws nothing on gl_compatibility on a GPU of a disabled vendor', () => {
    const material = new THREE.MeshBasicMaterial();
    const { prepass, draws, reach } = prepassSceneOn('Apple M2', COMPATIBILITY, meshOf(material));
    reach(prepass.first);
    expect(draws).toEqual([]);
    expect(material).toMatchObject({ depthFunc: THREE.LessEqualDepth, depthWrite: true });
  });

  it('reads the GPU name again after a context that named none, as a lost one does', () => {
    let gpu: string | null = null;
    const { prepass, draws, reach } = prepassSceneOn(
      () => gpu,
      COMPATIBILITY,
      meshOf(new THREE.MeshBasicMaterial())
    );
    reach(prepass.first);
    reach(prepass.last);
    gpu = 'Apple M2';
    draws.length = 0;
    reach(prepass.first);
    expect(draws).toEqual([]);
  });

  it('draws a material with the same prepass draw each frame', () => {
    const material = new THREE.MeshBasicMaterial();
    expect(ownProgramDraw(material)).toBe(ownProgramDraw(material));
  });

  it('draws on Forward+ whatever the GPU, as only gl_compatibility reads the vendors', () => {
    const { prepass, draws, reach } = prepassSceneOn(
      'Apple M2',
      FORWARD_PLUS,
      meshOf(new THREE.MeshBasicMaterial())
    );
    reach(prepass.first);
    expect(draws).toHaveLength(1);
  });

  it('draws nothing on Mobile, which has no depth prepass', () => {
    const { prepass, draws, reach } = prepassScene(
      { renderingMethod: 'mobile' },
      meshOf(new THREE.MeshBasicMaterial())
    );
    reach(prepass.first);
    expect(draws).toEqual([]);
  });

  it('sorts its first sentinel before every opaque draw and its last after', () => {
    const { first, last } = createDepthPrepass();
    expect([first.renderOrder, last.renderOrder]).toEqual([Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
  });
});
