/**
 * The CanvasGroup pass, driven through a recording renderer: happy-dom has no WebGL, and the
 * renderer is the boundary the pass draws through. Each draw records the target bound for it and
 * which of the scene's meshes the camera would see.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { offscreenRendererState } from '../../nodes/viewport/subviewport/offscreenRenderer.testkit';
import {
  canvasGroupRectTag,
  drawCanvasGroups,
  registerCanvasGroup,
  type CanvasGroupEntry,
} from './canvasGroupPass';

type Target = THREE.WebGLRenderTarget | null;

/** Whether `mesh` would draw now: it and every ancestor shown, and in the camera's layers. */
function seen(mesh: THREE.Object3D, camera: THREE.Camera): boolean {
  for (let o: THREE.Object3D | null = mesh; o; o = o.parent) if (!o.visible) return false;
  return camera.layers.test(mesh.layers);
}

function recordingRenderer(meshes: Record<string, THREE.Mesh>) {
  const draws: { target: Target; seen: string[] }[] = [];
  const clears: Target[] = [];
  let bound: Target = null;
  const gl = {
    ...offscreenRendererState(),
    getRenderTarget: () => bound,
    setRenderTarget: (target: Target) => {
      bound = target;
    },
    clear: () => {
      clears.push(bound);
    },
    render: (_scene: THREE.Object3D, camera: THREE.Camera) => {
      const names = Object.keys(meshes).filter((name) => seen(meshes[name]!, camera));
      draws.push({ target: bound, seen: names });
    },
  };
  return { gl: gl as unknown as THREE.WebGLRenderer & typeof gl, draws, clears };
}

/** A unit square mesh at `x` under a wrapper group carrying `key`, as a canvas item draws. */
function item(scene: THREE.Object3D, key: number, x: number): THREE.Mesh {
  const wrapper = new THREE.Group();
  wrapper.renderOrder = key;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  mesh.position.x = x;
  wrapper.add(mesh);
  scene.add(wrapper);
  return mesh;
}

function entry(window: CanvasGroupEntry['window'], buffer: Target): CanvasGroupEntry {
  return { window, buffer, fit: vi.fn(() => null) };
}

const camera = new THREE.OrthographicCamera();
/** The window of a group keyed 10 over a run of keys 10 to 19. */
const WINDOW = { own: 10, from: 10, to: 20 };
const FRAME = { width: 64, height: 32 };
const releases: (() => void)[] = [];
afterEach(() => releases.splice(0).forEach((release) => release()));

function register(scene: THREE.Object3D, group: CanvasGroupEntry): void {
  releases.push(registerCanvasGroup(scene, group));
}

describe('drawCanvasGroups', () => {
  it('draws only the frame when the scene holds no group', () => {
    const scene = new THREE.Scene();
    const meshes = { a: item(scene, 5, 0) };
    const { gl, draws } = recordingRenderer(meshes);

    drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

    expect(draws).toEqual([{ target: null, seen: ['a'] }]);
  });

  it('draws a grouped item into the buffer and leaves it out of the frame', () => {
    const scene = new THREE.Scene();
    const meshes = { before: item(scene, 5, 0), grouped: item(scene, 11, 0), after: item(scene, 25, 0) };
    const buffer = new THREE.WebGLRenderTarget(1, 1);
    register(scene, entry(WINDOW, buffer));
    const { gl, draws } = recordingRenderer(meshes);

    drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

    expect(draws).toEqual([
      { target: buffer, seen: ['grouped'] },
      { target: null, seen: ['before', 'after'] },
    ]);
    expect(seen(meshes.grouped, camera)).toBe(true);
  });

  it('clears the buffer when the renderer clears no colour on render, as over a kept target', () => {
    const scene = new THREE.Scene();
    item(scene, 11, 0);
    const buffer = new THREE.WebGLRenderTarget(1, 1);
    register(scene, entry(WINDOW, buffer));
    const { gl, clears } = recordingRenderer({});
    gl.autoClearColor = false;

    drawCanvasGroups(gl, scene, camera, FRAME, () => {});

    expect(clears).toEqual([buffer]);
  });

  it('sizes the buffer like the frame', () => {
    const scene = new THREE.Scene();
    item(scene, 11, 0);
    const buffer = new THREE.WebGLRenderTarget(1, 1);
    register(scene, entry(WINDOW, buffer));
    const { gl } = recordingRenderer({});

    drawCanvasGroups(gl, scene, camera, FRAME, () => {});

    expect([buffer.width, buffer.height]).toEqual([64, 32]);
  });

  it('groups an item that draws behind the group, whose key is below the group key', () => {
    // A CanvasGroup culls every child before itself (`renderer_canvas_cull.cpp:471-484`).
    const scene = new THREE.Scene();
    const meshes = { behind: item(scene, 10, 0), rect: item(scene, 11, 0), child: item(scene, 12, 0) };
    const buffer = new THREE.WebGLRenderTarget(1, 1);
    register(scene, entry({ own: 11, from: 10, to: 20 }, buffer));
    const { gl, draws } = recordingRenderer(meshes);

    drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

    expect(draws).toEqual([
      { target: buffer, seen: ['behind', 'child'] },
      { target: null, seen: ['rect'] },
    ]);
  });

  it('hands the group the world box of each grouped mesh, and draws no buffer it does not read', () => {
    const scene = new THREE.Scene();
    item(scene, 11, 3);
    const group = entry(WINDOW, null);
    register(scene, group);
    const { gl, draws } = recordingRenderer({});

    drawCanvasGroups(gl, scene, camera, FRAME, () => {});

    expect(draws).toEqual([]);
    const [drawn, nested] = vi.mocked(group.fit).mock.calls[0]!;
    expect(drawn.map((box) => [box.min.x, box.max.x])).toEqual([[2.5, 3.5]]);
    expect(nested).toBe(false);
  });

  it("hands the group the clip the frame's camera shows", () => {
    const scene = new THREE.Scene();
    const group = entry(WINDOW, null);
    register(scene, group);

    drawCanvasGroups(recordingRenderer({}).gl, scene, camera, FRAME, () => {});

    expect(vi.mocked(group.fit).mock.calls[0]![2]).toEqual({
      rect: { x: -1, y: -1, w: 2, h: 2 },
      scale: { x: 32, y: 16 },
    });
  });

  it('leaves out a hidden mesh and a mesh the camera does not see', () => {
    const scene = new THREE.Scene();
    item(scene, 11, 0).visible = false;
    item(scene, 12, 0).layers.set(5);
    const group = entry(WINDOW, null);
    register(scene, group);

    drawCanvasGroups(recordingRenderer({}).gl, scene, camera, FRAME, () => {});

    expect(vi.mocked(group.fit).mock.calls[0]![0]).toEqual([]);
  });

  it('draws a nested group plain into the outer buffer, and merges its rect into the outer one', () => {
    const scene = new THREE.Scene();
    const meshes = { inner: item(scene, 13, 0) };
    const outerBuffer = new THREE.WebGLRenderTarget(1, 1);
    const innerBuffer = new THREE.WebGLRenderTarget(1, 1);
    const innerRect = new THREE.Box3(new THREE.Vector3(-9, -9, 0), new THREE.Vector3(9, 9, 0));
    const outer = entry(WINDOW, outerBuffer);
    const inner = {
      ...entry({ own: 12, from: 12, to: 15 }, innerBuffer),
      fit: vi.fn((..._args: Parameters<CanvasGroupEntry['fit']>) => innerRect),
    };
    register(scene, outer);
    register(scene, inner);
    const { gl, draws } = recordingRenderer(meshes);

    drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

    expect(inner.fit.mock.calls[0]![1]).toBe(true);
    expect(vi.mocked(outer.fit).mock.calls[0]![0]).toContain(innerRect);
    expect(draws).toEqual([
      { target: outerBuffer, seen: ['inner'] },
      { target: null, seen: [] },
    ]);
  });

  it('leaves the rect of another group out of the drawn boxes, which take its fitted rect instead', () => {
    const scene = new THREE.Scene();
    const rect = item(scene, 12, 0);
    rect.userData = { ...canvasGroupRectTag() };
    const outer = entry(WINDOW, null);
    register(scene, outer);

    drawCanvasGroups(recordingRenderer({}).gl, scene, camera, FRAME, () => {});

    expect(vi.mocked(outer.fit).mock.calls[0]![0]).toEqual([]);
  });
});
