/**
 * The CanvasGroup pass, driven through a recording renderer: happy-dom has no WebGL, and the
 * renderer is the boundary the pass draws through. Each draw records the target bound for it and
 * which of the scene's meshes the camera would see.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { offscreenRendererState } from '../../nodes/viewport/subviewport/offscreenRenderer.testkit';
import { drawCanvasGroups, registerCanvasGroup } from './canvasGroupPass';
import { canvasGroupRectTag } from './keyedScene';
import type { CanvasGroupEntry, CompositeEntry } from './groupEntries';

type Target = THREE.WebGLRenderTarget | null;

// The copy is a full-screen draw, which the recording renderer cannot run: the mock records it as a
// draw of the target it fills, so a test reads its place among the other draws.
vi.mock('../texelCopy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../texelCopy')>()),
  copyTexels: vi.fn((gl: { copied: (source: THREE.Texture, target: Target) => void }, source, target) =>
    gl.copied(source, target)
  ),
}));

/** Whether `mesh` would draw now: it and every ancestor shown, and in the camera's layers. */
function seen(mesh: THREE.Object3D, camera: THREE.Camera): boolean {
  for (let o: THREE.Object3D | null = mesh; o; o = o.parent) if (!o.visible) return false;
  return camera.layers.test(mesh.layers);
}

/** Whether `root` is `mesh` or one of its ancestors: a render of a subtree draws only what is below it. */
function within(root: THREE.Object3D, mesh: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = mesh; o; o = o.parent) if (o === root) return true;
  return false;
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
    // A colour clear only: a clip buffer keeps the colour it copied, and clears its depth.
    clear: (clearsColor?: boolean) => {
      if (clearsColor) clears.push(bound);
    },
    render: (root: THREE.Object3D, camera: THREE.Camera) => {
      const names = Object.keys(meshes).filter(
        (name) => within(root, meshes[name]!) && seen(meshes[name]!, camera)
      );
      draws.push({ target: bound, seen: names });
    },
    copied: (source: THREE.Texture, target: Target) => {
      draws.push({ target, seen: [source.name] });
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

/** A mesh under the wrapper of `owner`, as a child canvas item sits under its parent's group. */
function childOf(owner: THREE.Mesh, key: number, x: number): THREE.Mesh {
  return item(owner.parent!, key, x);
}

/** The rect a group's `fit` answers, as a group that draws something does. */
const FITTED = new THREE.Box3(new THREE.Vector3(-1, -1, 0), new THREE.Vector3(1, 1, 0));

function entry(window: CanvasGroupEntry['window'], buffer: Target): CompositeEntry {
  return { kind: 'composite', window, buffer, fit: vi.fn(() => FITTED), fitNested: vi.fn(() => FITTED) };
}

const camera = new THREE.OrthographicCamera();
/** The window of a group keyed 10 over a run of keys 10 to 19. */
const WINDOW = { own: 10, from: 10, to: 20 };
const FRAME = { width: 64, height: 32, texture: Object.assign(new THREE.Texture(), { name: 'frame' }) };
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

  it('draws no buffer for a group whose fit answers no rect, as it draws nothing', () => {
    const scene = new THREE.Scene();
    const meshes = { grouped: item(scene, 11, 0) };
    const buffer = new THREE.WebGLRenderTarget(1, 1);
    register(scene, { ...entry(WINDOW, buffer), fit: () => null });
    const { gl, draws } = recordingRenderer(meshes);

    drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

    expect(draws).toEqual([{ target: null, seen: [] }]);
  });

  it('groups an item that draws behind the group, whose key is below the group key', () => {
    // A CanvasGroup culls every child before itself (`renderer_canvas_cull.cpp:471-484`).
    const scene = new THREE.Scene();
    const rect = item(scene, 11, 0);
    const meshes = { behind: childOf(rect, 10, 0), rect, child: childOf(rect, 12, 0) };
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
    const [drawn] = vi.mocked(group.fit).mock.calls[0]!;
    expect(drawn.map((box) => [box.min.x, box.max.x])).toEqual([[2.5, 3.5]]);
    expect(group.fitNested).not.toHaveBeenCalled();
  });

  it("hands the group the clip the frame's camera shows", () => {
    const scene = new THREE.Scene();
    const group = entry(WINDOW, null);
    register(scene, group);

    drawCanvasGroups(recordingRenderer({}).gl, scene, camera, FRAME, () => {});

    expect(vi.mocked(group.fit).mock.calls[0]![1]).toEqual({
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
      fitNested: vi.fn((..._args: Parameters<CompositeEntry['fitNested']>) => innerRect),
    };
    register(scene, outer);
    register(scene, inner);
    const { gl, draws } = recordingRenderer(meshes);

    drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

    expect(inner.fitNested).toHaveBeenCalled();
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

  describe('a clipping group', () => {
    /** A clipping group over `WINDOW`, its mask switch recorded as the renderer draws. */
    function clipEntry(mode: 'clipOnly' | 'clipAndDraw', buffer: Target, state: { masking: boolean }) {
      const startMasking = vi.fn(() => {
        state.masking = true;
      });
      const stopMasking = vi.fn(() => {
        state.masking = false;
      });
      return {
        ...entry(WINDOW, buffer),
        kind: 'clip' as const,
        buffer: buffer!,
        readsBuffer: true,
        clip: { mode, startMasking, stopMasking, behind: [] },
      };
    }

    /** The scene of a clipping parent at key 10 with a child at 11, drawn between a mesh before and one after. */
    function clippedScene() {
      const scene = new THREE.Scene();
      const meshes = {
        before: item(scene, 5, 0),
        owner: item(scene, 10, 0),
        child: undefined as unknown as THREE.Mesh,
        after: item(scene, 25, 0),
      };
      meshes.child = childOf(meshes.owner, 11, 0);
      return { scene, meshes };
    }

    it('copies the canvas drawn so far into the buffer, draws the child over it, and masks the owner', () => {
      const { scene, meshes } = clippedScene();
      const buffer = new THREE.WebGLRenderTarget(1, 1);
      const state = { masking: false };
      register(scene, clipEntry('clipOnly', buffer, state));
      const { gl, draws, clears } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(draws).toEqual([
        { target: null, seen: ['before'] },
        { target: buffer, seen: ['frame'] },
        { target: buffer, seen: ['child'] },
        { target: null, seen: ['owner', 'after'] },
      ]);
      expect(clears).toEqual([]);
    });

    it('sizes the buffer region over the rect of a group nested in the clipping window, margins included', () => {
      const { scene, meshes } = clippedScene();
      const buffer = new THREE.WebGLRenderTarget(1, 1);
      register(scene, clipEntry('clipOnly', buffer, { masking: false }));
      const nestedBuffer = new THREE.WebGLRenderTarget(1, 1);
      register(scene, entry({ own: 12, from: 12, to: 15 }, nestedBuffer));
      const { gl } = recordingRenderer(meshes);
      const widths: number[] = [];
      const render = gl.render;
      gl.render = (root: THREE.Object3D, cam: THREE.Camera) => {
        if (buffer.scissorTest) widths.push(buffer.scissor.width);
        render(root, cam);
      };

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      // The nested rect (FITTED, -1 to 1) spans the 64-texel frame; the unit child alone spans 32 plus the pad.
      expect(widths[0]).toBe(FRAME.width);
    });

    it('freezes the matrices of the owner subtree it renders, so three does not recompute them', () => {
      const { scene, meshes } = clippedScene();
      register(scene, clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), { masking: false }));
      const { gl } = recordingRenderer(meshes);
      const frozen: boolean[] = [];
      const render = gl.render;
      gl.render = (root: THREE.Object3D, cam: THREE.Camera) => {
        frozen.push(!root.matrixWorldAutoUpdate);
        render(root, cam);
      };

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(frozen).toEqual([true, true, true]);
    });

    it('refreshes the camera view before it sizes the buffer region from it', () => {
      const { scene, meshes } = clippedScene();
      register(scene, clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), { masking: false }));
      const { gl } = recordingRenderer(meshes);
      const refresh = vi.spyOn(camera, 'updateMatrixWorld');

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(refresh).toHaveBeenCalled();
      refresh.mockRestore();
    });

    it("keeps the owner's own pieces, at keys inside its slot, out of the buffer", () => {
      const scene = new THREE.Scene();
      const owner = item(scene, 10, 0);
      const meshes = { owner, piece: childOf(owner, 10.5, 0), child: childOf(owner, 11, 0) };
      const buffer = new THREE.WebGLRenderTarget(1, 1);
      register(scene, clipEntry('clipOnly', buffer, { masking: false }));
      const { gl, draws } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(draws.map((draw) => [draw.target, ...draw.seen])).toEqual([
        [null],
        [buffer, 'frame'],
        [buffer, 'child'],
        [null, 'owner', 'piece'],
      ]);
    });

    it('hides the subtrees with no key in a span while it draws, and shows them again after', () => {
      const { scene, meshes } = clippedScene();
      register(scene, clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), { masking: false }));
      const { gl } = recordingRenderer(meshes);
      const hiddenAtDraw: string[][] = [];
      const wrappers = Object.entries(meshes).map(([name, mesh]) => [name, mesh.parent!] as const);

      drawCanvasGroups(gl, scene, camera, FRAME, () =>
        hiddenAtDraw.push(wrappers.filter(([, wrapper]) => !wrapper.visible).map(([name]) => name))
      );

      // The span before the group (key 5) hides the keys from 10 on, and the span after hides key 5.
      expect(hiddenAtDraw).toEqual([['owner', 'after'], ['before']]);
      expect(wrappers.every(([, wrapper]) => wrapper.visible)).toBe(true);
    });

    it('draws a span only the keys inside it, also in an item that has a behind-parent child in it', () => {
      const { scene, meshes } = clippedScene();
      const parent = item(scene, 25, 0);
      const behind = childOf(parent, 5, 0);
      register(scene, clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), { masking: false }));
      const { gl, draws } = recordingRenderer({ ...meshes, parent, behind });

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      const frameDraws = draws.filter((draw) => draw.target === null).map((draw) => draw.seen);
      expect(frameDraws).toEqual([
        ['before', 'behind'],
        ['owner', 'after', 'parent'],
      ]);
    });

    it('masks the owner while the frame draws it and not while the buffer fills', () => {
      const { scene, meshes } = clippedScene();
      const state = { masking: false };
      const maskedAtDraw: boolean[] = [];
      register(scene, clipEntry('clipAndDraw', new THREE.WebGLRenderTarget(1, 1), state));
      const { gl } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => maskedAtDraw.push(state.masking));
      const filled: boolean[] = [];
      gl.render = () => filled.push(state.masking);
      drawCanvasGroups(gl, scene, camera, FRAME, () => {});

      expect(maskedAtDraw).toEqual([false, true]);
      expect(filled).toEqual([false, false]);
    });

    it('copies only the texels under the owner and its children, with the margin a group clears', () => {
      const { scene, meshes } = clippedScene();
      meshes.child.position.x = 0.5;
      const buffer = new THREE.WebGLRenderTarget(1, 1);
      register(scene, clipEntry('clipOnly', buffer, { masking: false }));
      const { gl } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(buffer.scissorTest).toBe(true);
      expect(buffer.scissor.toArray()).toEqual([10, 2, 54, 28]);
    });

    it('draws the owner first into the buffer in CLIP_AND_DRAW, whatever key its children have, and not in CLIP_ONLY', () => {
      const buffers = {
        clipOnly: new THREE.WebGLRenderTarget(1, 1),
        clipAndDraw: new THREE.WebGLRenderTarget(1, 1),
      };
      const filled = (mode: keyof typeof buffers) => {
        const scene = new THREE.Scene();
        // A child behind the owner, as `show_behind_parent` puts it, and a child over it.
        const owner = item(scene, 12, 0);
        const meshes = { behind: childOf(owner, 9, 0), owner, child: childOf(owner, 11, 0) };
        register(scene, {
          ...clipEntry(mode, buffers[mode], { masking: false }),
          window: { own: 12, from: 8, to: 20 },
        });
        const { gl, draws } = recordingRenderer(meshes);
        drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));
        return draws
          .filter((draw) => draw.target === buffers[mode] && draw.seen[0] !== 'frame')
          .map((draw) => draw.seen);
      };

      expect(filled('clipOnly')).toEqual([['behind', 'child']]);
      expect(filled('clipAndDraw')).toEqual([['owner'], ['behind', 'child']]);
    });

    it('draws the show_behind_parent children of an owner that draws nothing before its other children', () => {
      const scene = new THREE.Scene();
      // The child at index 0 sits before the one that draws behind the parent, as in the scene tree.
      const meshes = {
        before: item(scene, 5, 0),
        front: item(scene, 11, 0),
        behind: item(scene, 12, 0),
        after: item(scene, 25, 0),
      };
      const state = { masking: false };
      register(scene, {
        ...clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), state),
        clip: {
          mode: 'clipOnly',
          startMasking: vi.fn(),
          stopMasking: vi.fn(),
          behind: [{ from: 12, to: 13 }],
        },
      });
      const { gl, draws } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(draws.map((draw) => draw.seen)).toEqual([['before'], ['behind'], ['front', 'after']]);
    });

    it('draws the behind children of an owner that draws nothing once, when a clipping group splits its window', () => {
      const scene = new THREE.Scene();
      const clipOwner = item(scene, 15, 0);
      const meshes = {
        clipOwner,
        clipChild: childOf(clipOwner, 16, 0),
        behind: item(scene, 28, 0),
      };
      register(scene, {
        ...clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), { masking: false }),
        window: { own: 10, from: 10, to: 30 },
        clip: {
          mode: 'clipOnly',
          startMasking: vi.fn(),
          stopMasking: vi.fn(),
          behind: [{ from: 28, to: 29 }],
        },
      });
      register(scene, {
        ...clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), { masking: false }),
        window: { own: 15, from: 15, to: 20 },
      });
      const { gl, draws } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      const times = draws.filter((draw) => draw.target === null && draw.seen.includes('behind')).length;
      expect(times).toBe(1);
    });

    it('draws a clipping owner in the behind span of an inert owner after its buffer fills, masked', () => {
      const scene = new THREE.Scene();
      const owner = item(scene, 34, 0);
      const meshes = { sibling: item(scene, 12, 0), owner, child: childOf(owner, 31, 0) };
      register(scene, {
        ...clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), { masking: false }),
        window: { own: 10, from: 10, to: 40 },
        clip: {
          mode: 'clipOnly',
          startMasking: vi.fn(),
          stopMasking: vi.fn(),
          behind: [{ from: 30, to: 35 }],
        },
      });
      const state = { masking: false };
      register(scene, {
        ...clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), state),
        window: { own: 34, from: 30, to: 35 },
      });
      const { gl } = recordingRenderer(meshes);
      const maskingWhenOwnerDraws: boolean[] = [];
      const render = gl.render;
      gl.render = (root: THREE.Object3D, cam: THREE.Camera) => {
        if (gl.getRenderTarget() === null && within(root, owner) && seen(owner, cam))
          maskingWhenOwnerDraws.push(state.masking);
        render(root, cam);
      };

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(maskingWhenOwnerDraws).toEqual([true]);
    });

    it('draws no group for a clipping owner that draws nothing, as Godot attaches no group to an item with no commands', () => {
      const scene = new THREE.Scene();
      const meshes = { before: item(scene, 5, 0), child: item(scene, 11, 0) };
      register(scene, clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), { masking: false }));
      const { gl, draws } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(draws).toEqual([{ target: null, seen: ['before', 'child'] }]);
    });

    it('leaves a group inside a clipping owner that draws nothing outermost', () => {
      const scene = new THREE.Scene();
      const meshes = { child: item(scene, 13, 0) };
      const innerBuffer = new THREE.WebGLRenderTarget(1, 1);
      const inner = entry({ own: 12, from: 12, to: 15 }, innerBuffer);
      register(scene, clipEntry('clipOnly', new THREE.WebGLRenderTarget(1, 1), { masking: false }));
      register(scene, inner);
      const { gl, draws } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(inner.fit).toHaveBeenCalled();
      expect(inner.fitNested).not.toHaveBeenCalled();
      expect(draws[0]).toEqual({ target: innerBuffer, seen: ['child'] });
    });

    it('draws nothing for a CLIP_ONLY owner whose group lists no child, and the owner plain in CLIP_AND_DRAW', () => {
      const drawnOf = (mode: 'clipOnly' | 'clipAndDraw') => {
        const { scene, meshes } = clippedScene();
        register(scene, {
          ...clipEntry(mode, new THREE.WebGLRenderTarget(1, 1), { masking: false }),
          fit: () => null,
        });
        const { gl, draws } = recordingRenderer(meshes);
        drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));
        return draws;
      };

      expect(drawnOf('clipOnly')).toEqual([{ target: null, seen: ['before', 'after'] }]);
      expect(drawnOf('clipAndDraw')).toEqual([{ target: null, seen: ['before', 'owner', 'after'] }]);
    });

    it('draws a clipping group inside another group plain, with no copy and no mask', () => {
      const { scene, meshes } = clippedScene();
      const outerBuffer = new THREE.WebGLRenderTarget(1, 1);
      const state = { masking: false };
      const inner = {
        ...clipEntry('clipAndDraw', new THREE.WebGLRenderTarget(1, 1), state),
        window: { own: 11, from: 11, to: 14 },
      };
      register(scene, entry({ own: 4, from: 4, to: 20 }, outerBuffer));
      register(scene, inner);
      const { gl, draws } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(draws).toEqual([
        { target: outerBuffer, seen: ['before', 'owner', 'child'] },
        { target: null, seen: ['after'] },
      ]);
      expect(inner.clip.startMasking).not.toHaveBeenCalled();
    });

    it('copies the canvas again for a second group, with the first one already masked in it', () => {
      const scene = new THREE.Scene();
      const owner1 = item(scene, 10, 0);
      const owner2 = item(scene, 30, 0);
      const meshes = {
        owner1,
        child1: childOf(owner1, 11, 0),
        owner2,
        child2: childOf(owner2, 31, 0),
      };
      const first = new THREE.WebGLRenderTarget(1, 1);
      const second = new THREE.WebGLRenderTarget(1, 1);
      register(scene, clipEntry('clipOnly', first, { masking: false }));
      register(scene, {
        ...clipEntry('clipOnly', second, { masking: false }),
        window: { own: 30, from: 30, to: 40 },
      });
      const { gl, draws } = recordingRenderer(meshes);

      drawCanvasGroups(gl, scene, camera, FRAME, () => gl.render(scene, camera));

      expect(draws.map((draw) => [draw.target, ...draw.seen])).toEqual([
        [null],
        [first, 'frame'],
        [first, 'child1'],
        [null, 'owner1'],
        [second, 'frame'],
        [second, 'child2'],
        [null, 'owner2'],
      ]);
    });
  });
});
