/**
 * A Control with `clip_children` is a clipping group like a Node2D: its own quad draws as the mask,
 * and the Controls under it draw into the group's buffer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Rect2 } from '../../../godot/math/rect2';
import { nativeTheme } from './nativeTheme';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { controlNode, solveNode as solveNodeDefaults, withPaintRanges } from './testing/solveNode';
import type { SolveNode } from './solveTree';
import { controlComponentRegistry, type NativeControlComponent } from '../ControlComponentRegistry';
import { ControlQuad } from './controlQuad';
import { controlProps } from '../../../nodes/2d/ui/control/testing/controlProps';
import { drawCanvasGroups } from '../../canvasGroup/canvasGroupPass';
import { offscreenRendererState } from '../../../nodes/viewport/subviewport/offscreenRenderer.testkit';

vi.mock('../../contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));
vi.mock('../../texelCopy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../texelCopy')>()),
  copyTexels: vi.fn(),
}));

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };

const QuadPainter: NativeControlComponent = ({ renderOrder }) => (
  <ControlQuad width={1} height={1} color={new THREE.Color(1, 1, 1)} opacity={1} renderOrder={renderOrder} />
);

function control(path: string, properties: Record<string, unknown>, children: SolveNode[] = []): SolveNode {
  const name = path.split('/').pop()!;
  return {
    ...solveNodeDefaults(),
    path,
    node: controlNode(name, 'TestRect', controlProps({ name, ...properties })),
    children,
  };
}

/** Whether `object` and every ancestor are visible, as a render draws only those. */
function isShown(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/** Which of the parent's and child's quads the pass draws into which target. */
async function drawnBy(clipChildren: number) {
  controlComponentRegistry.register({ typeName: 'TestRect', Component: QuadPainter });
  const [tree] = withPaintRanges([control('Parent', { clipChildren }, [control('Parent/Child', {})])]);
  const renderer = await ReactThreeTestRenderer.create(
    <ControlCanvasWalker
      tree={[tree!]}
      generation={0}
      viewport={VIEWPORT}
      theme={nativeTheme(1)}
      measurer={null}
    />
  );
  const scene = renderer.scene.instance as THREE.Scene;
  const meshes = renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);
  const [parent, child] = meshes;
  const camera = new THREE.OrthographicCamera();
  const draws: { target: unknown; seen: string[] }[] = [];
  let bound: unknown = null;
  const gl = {
    ...offscreenRendererState(),
    getRenderTarget: () => bound,
    setRenderTarget: (target: unknown) => {
      bound = target;
    },
    clear: () => {},
    render: () => {
      const seen = [parent!, child!]
        .filter((mesh) => camera.layers.test(mesh.layers) && isShown(mesh))
        .map((mesh) => (mesh === parent ? 'parent' : 'child'));
      draws.push({ target: bound, seen });
    },
  } as unknown as THREE.WebGLRenderer;
  drawCanvasGroups(gl, scene, camera, { width: 64, height: 64, texture: new THREE.Texture() }, () =>
    gl.render(scene, camera)
  );
  return draws;
}

describe('<ControlCanvasWalker> clip_children', () => {
  afterEach(() => controlComponentRegistry.clear());

  it('draws the child into the group buffer and the parent over the frame', async () => {
    const draws = await drawnBy(1);

    expect(draws.map(({ target, seen }) => [target === null, ...seen])).toEqual([
      [true],
      [false, 'child'],
      [true, 'parent'],
    ]);
  });

  it('draws both in one frame without clip_children', async () => {
    const draws = await drawnBy(0);

    expect(draws).toEqual([{ target: null, seen: ['parent', 'child'] }]);
  });
});
