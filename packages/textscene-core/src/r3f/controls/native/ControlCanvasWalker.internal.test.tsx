/**
 * The walker paints an internal Control (`internalControls.ts`) as it paints an authored one: at the
 * snapped origin of its solved rect, with the tint a child canvas item takes, and with its own
 * internal Controls.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { Rect2 } from '../../../godot/math/rect2';
import type { SolveNode } from './solveTree';
import { nativeTheme } from './nativeTheme';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { controlNode, solveNode, withPaintRanges } from './testing/solveNode';
import { controlComponentRegistry, type NativeControlComponentProps } from '../ControlComponentRegistry';
import { registerInternalControls } from './internalControls';
import { controlProps } from '../../../nodes/2d/ui/control/testing/controlProps';

vi.mock('../../contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);
const HOST = 'HostOfAProbe';
const INNER = 'InnerProbe';

registerInternalControls(
  HOST,
  () => [{ mode: 'front', spec: { type: INNER, name: 'Inner', properties: { name: 'Inner' } } }],
  (_host, [inner]) => new Map([[inner!.node.path, { x: 10.5, y: 20.5, w: 30, h: 40 }]])
);

const RED = { r: 1, g: 0, b: 0, a: 1 };

/** A host whose internal Control sets its own `self_modulate`, as a constructor's `set_self_modulate` does. */
const TINTED_HOST = 'HostOfATintedProbe';
registerInternalControls(
  TINTED_HOST,
  () => [
    { mode: 'front', spec: { type: INNER, name: 'Inner', properties: { name: 'Inner', selfModulate: RED } } },
  ],
  (_host, [inner]) => new Map([[inner!.node.path, { x: 0, y: 0, w: 30, h: 40 }]])
);

/** A host whose internal Control builds internal Controls of its own, as a ColorPicker's SpinBox does. */
const NESTING_HOST = 'HostOfANestingProbe';
const MIDDLE = 'MiddleOfAProbe';
registerInternalControls(
  NESTING_HOST,
  () => [{ mode: 'front', spec: { type: MIDDLE, name: 'Middle', properties: { name: 'Middle' } } }],
  (_host, [middle]) => new Map([[middle!.node.path, { x: 5, y: 5, w: 50, h: 50 }]])
);
registerInternalControls(
  MIDDLE,
  () => [{ mode: 'front', spec: { type: INNER, name: 'Inner', properties: { name: 'Inner' } } }],
  (_middle, [inner]) => new Map([[inner!.node.path, { x: 7, y: 9, w: 20, h: 20 }]])
);

/** A host whose internal Control has a child and a back-mode internal Control of its own. */
const BACK_NESTING_HOST = 'HostOfABackNestingProbe';
const MIDDLE_WITH_CHILD = 'MiddleWithAChild';
const CHILD = 'ChildProbe';
registerInternalControls(
  BACK_NESTING_HOST,
  () => [
    {
      mode: 'front',
      spec: {
        type: MIDDLE_WITH_CHILD,
        name: 'Middle',
        properties: {},
        children: [{ type: CHILD, name: 'Child', properties: {} }],
      },
    },
  ],
  (_host, [middle]) => new Map([[middle!.node.path, { x: 0, y: 0, w: 50, h: 50 }]])
);
registerInternalControls(
  MIDDLE_WITH_CHILD,
  () => [{ mode: 'back', spec: { type: INNER, name: 'Inner', properties: {} } }],
  (_middle, [inner]) => new Map([[inner!.node.path, { x: 0, y: 0, w: 20, h: 20 }]])
);

/** A host that draws on its internal Control through the `draw` signal, as a ColorPicker draws on its sample. */
const DRAWING_HOST = 'HostThatDrawsOnAProbe';
registerInternalControls(
  DRAWING_HOST,
  () => [
    {
      mode: 'front',
      spec: { type: INNER, name: 'Inner', properties: { name: 'Inner' }, draws: drawnProbe },
    },
    { mode: 'front', spec: { type: CHILD, name: 'Next', properties: { name: 'Next' } } },
  ],
  (_host, internals) => new Map(internals.map(({ node }) => [node.path, { x: 0, y: 0, w: 20, h: 20 }]))
);

/** A host whose internal Control wraps its children, as a ScrollContainer's painter does. */
const WRAPPING_HOST = 'HostOfAWrapper';
const WRAPPER = 'WrappingProbe';
registerInternalControls(
  WRAPPING_HOST,
  () => [
    {
      mode: 'front',
      spec: {
        type: WRAPPER,
        name: 'Wrapper',
        properties: { name: 'Wrapper' },
        children: [{ type: CHILD, name: 'Child', properties: { name: 'Child' } }],
      },
    },
  ],
  (_host, [wrapper]) => new Map([[wrapper!.node.path, { x: 0, y: 0, w: 50, h: 50 }]])
);

afterEach(() => controlComponentRegistry.clear());

interface Positioned {
  position: { x: number; y: number };
  parent: Positioned;
}

interface ProbeInstance {
  name: string;
  /** The item's lit pixels, inside the item's group. */
  parent: Positioned;
  userData: { tint?: NativeControlComponentProps['tint']; renderOrder?: number };
}

function probePainter({ tint, renderOrder }: NativeControlComponentProps) {
  return <group name="inner-probe" userData={{ tint, renderOrder }} />;
}

function drawnProbe({ renderOrder }: NativeControlComponentProps) {
  return <group name="drawn-probe" userData={{ renderOrder }} />;
}

function wrappingPainter({ children }: NativeControlComponentProps) {
  return <group name="wrapper-probe">{children}</group>;
}

function childPainter({ renderOrder }: NativeControlComponentProps) {
  return <group name="child-probe" userData={{ renderOrder }} />;
}

function host(properties: Record<string, unknown> = {}, type = HOST): SolveNode {
  const props = controlProps({ name: 'Host', offsetRight: 100, offsetBottom: 100, ...properties });
  return { ...solveNode(), path: 'Host', node: controlNode('Host', type, props) };
}

async function probes(root: SolveNode, snapToPixels: boolean): Promise<ProbeInstance[]> {
  controlComponentRegistry.register({ typeName: INNER, Component: probePainter });
  controlComponentRegistry.register({ typeName: CHILD, Component: childPainter });
  const renderer = await ReactThreeTestRenderer.create(
    <ControlCanvasWalker
      tree={withPaintRanges([root])}
      generation={0}
      viewport={VIEWPORT}
      theme={THEME}
      measurer={null}
      snapToPixels={snapToPixels}
    />
  );
  return renderer.scene.findAllByType('Group').map((g) => g.instance as ProbeInstance);
}

async function probe(root: SolveNode, snapToPixels: boolean): Promise<ProbeInstance> {
  return (await probes(root, snapToPixels)).find((g) => g.name === 'inner-probe')!;
}

/** Where the probe's item draws: the group around its lit pixels. */
async function itemPosition(root: SolveNode, snapToPixels: boolean) {
  return (await probe(root, snapToPixels)).parent.parent.position;
}

describe('an internal Control in the walk', () => {
  it('draws at the snapped origin of its rect while the snap is on', async () => {
    const position = await itemPosition(host(), true);
    expect(position.x).toBeCloseTo(11);
    expect(position.y).toBeCloseTo(-21);
  });

  it('draws at its rect while the snap is off', async () => {
    const position = await itemPosition(host(), false);
    expect(position.x).toBeCloseTo(10.5);
    expect(position.y).toBeCloseTo(-20.5);
  });

  it("takes its parent's tint without the parent's self_modulate", async () => {
    const { userData } = await probe(host({ selfModulate: { r: 1, g: 0, b: 0, a: 1 } }), true);
    expect(userData.tint!.own).toMatchObject({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('tints its own pixels with its own self_modulate', async () => {
    const { userData } = await probe(host({}, TINTED_HOST), true);
    expect(userData.tint!.own).toMatchObject(RED);
  });

  it('draws its own internal Controls, at their rects inside it', async () => {
    const position = await itemPosition(host({}, NESTING_HOST), true);
    expect(position.x).toBeCloseTo(7);
    expect(position.y).toBeCloseTo(-9);
  });

  it('draws a back-mode internal Control of its own after its children (Node::INTERNAL_MODE_BACK)', async () => {
    const drawn = await probes(host({}, BACK_NESTING_HOST), true);
    const orderOf = (name: string) => drawn.find((g) => g.name === name)!.userData.renderOrder!;
    expect(orderOf('inner-probe')).toBeGreaterThan(orderOf('child-probe'));
  });

  describe('with what its parent draws on it', () => {
    const drawn = () => probes(host({}, DRAWING_HOST), true);
    const named = (all: ProbeInstance[], name: string) => all.find((g) => g.name === name)!;

    it('draws it after its own pixels and before the next Control (canvas_item.cpp:148-149)', async () => {
      const all = await drawn();
      const orderOf = (name: string) => named(all, name).userData.renderOrder!;
      expect(orderOf('drawn-probe')).toBeGreaterThan(orderOf('inner-probe'));
      expect(orderOf('child-probe')).toBeGreaterThan(orderOf('drawn-probe'));
    });

    it('draws it in the same lit item as its own pixels', async () => {
      const all = await drawn();
      expect(named(all, 'drawn-probe').parent).toBe(named(all, 'inner-probe').parent);
    });
  });

  it('hands its children to a painter that wraps them, as ControlItemGroup does', async () => {
    controlComponentRegistry.register({ typeName: WRAPPER, Component: wrappingPainter, wrapsChildren: true });
    const all = await probes(host({}, WRAPPING_HOST), true);
    const child = all.find((g) => g.name === 'child-probe') as unknown as THREE.Object3D;
    const ancestors: string[] = [];
    child.traverseAncestors((ancestor) => ancestors.push(ancestor.name));
    expect(ancestors).toContain('wrapper-probe');
  });
});
