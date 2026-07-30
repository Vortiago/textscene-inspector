import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { CanvasModulate } from './Component';
import { parseCanvasModulate } from './parser';
import { Modulate2DContext, useParentModulate, type RGBA } from '../../../r3f/canvasItemModulate';
import { YSortZProvider } from '../../../r3f/contexts/YSortContext';
import { Z_INDEX_STEP } from '../../../r3f/node2dTransform';

function cmNode(name = 'CM', props: Record<string, string> = {}): TscnNode {
  return {
    name,
    type: 'CanvasModulate',
    children: [],
    properties: parseCanvasModulate({ type: 'node', attributes: { type: 'CanvasModulate', name } }, props),
  };
}

/**
 * Reads the Modulate2DContext value from within a CanvasModulate subtree and
 * parks it on a mesh's `userData` — scene-scoped capture (no module globals),
 * read back via `findByProps({ name: 'modulate-reader' })`.
 */
function ModulateReader() {
  const modulate = useParentModulate();
  return <mesh name="modulate-reader" userData={{ modulate }} />;
}

async function renderCM(props: Record<string, string> = {}, wrap?: (kid: ReactNode) => ReactNode) {
  const kid = (
    <CanvasModulate node={cmNode('CM', props)}>
      <ModulateReader />
    </CanvasModulate>
  );
  return ReactThreeTestRenderer.create(<>{wrap ? wrap(kid) : kid}</>);
}

/** The CanvasModulate group (the context provider adds no scene node). */
function cmGroup(renderer: Awaited<ReturnType<typeof renderCM>>) {
  return renderer.scene.children[0]!.instance as {
    name: string;
    visible: boolean;
    position: { x: number; y: number; z: number };
  };
}

function readModulate(renderer: Awaited<ReturnType<typeof renderCM>>): RGBA {
  return renderer.scene.findByProps({ name: 'modulate-reader' }).instance.userData.modulate as RGBA;
}

describe('<CanvasModulate>', () => {
  it('renders a <group> element named after the node', async () => {
    const renderer = await renderCM();
    expect(cmGroup(renderer).name).toBe('CM');
    renderer.unmount();
  });

  // The tint is a property of the CANVAS, not of this subtree: `NodeDispatcher`
  // seeds it from `canvasModulateColor` so a childless CanvasModulate still
  // tints the scene. Rendered in isolation the node therefore passes its parent
  // modulate straight through — folding `color` in here too would square it
  // over its own descendants. `canvasModulate.test.ts` pins the collection, and
  // the slice contract pins the end-to-end tint through the dispatcher.
  it('passes the inherited modulate through untouched — the tint is canvas-level', async () => {
    const renderer = await renderCM({ color: 'Color(0.5, 0.5, 1, 1)' });
    const captured = readModulate(renderer);
    expect(captured.r).toBeCloseTo(1, 3);
    expect(captured.g).toBeCloseTo(1, 3);
    expect(captured.b).toBeCloseTo(1, 3);
    expect(captured.a).toBeCloseTo(1, 3);
    renderer.unmount();
  });

  it('default white color x white parent yields white', async () => {
    const renderer = await renderCM();
    const captured = readModulate(renderer);
    expect(captured.r).toBeCloseTo(1, 3);
    expect(captured.g).toBeCloseTo(1, 3);
    expect(captured.b).toBeCloseTo(1, 3);
    expect(captured.a).toBeCloseTo(1, 3);
    renderer.unmount();
  });

  it('still inherits an ancestor modulate, as any Node2D does', async () => {
    const renderer = await renderCM({ color: 'Color(0.5, 0.5, 1, 1)' }, (kid) => (
      <Modulate2DContext.Provider value={{ r: 0.5, g: 1, b: 0.5, a: 1 }}>{kid}</Modulate2DContext.Provider>
    ));
    const captured = readModulate(renderer);
    expect(captured.r).toBeCloseTo(0.5, 3);
    expect(captured.g).toBeCloseTo(1, 3);
    expect(captured.b).toBeCloseTo(0.5, 3);
    renderer.unmount();
  });

  it('applies a non-origin position to the group', async () => {
    const renderer = await renderCM({ position: 'Vector2(50, -30)' });
    const group = cmGroup(renderer);
    // Godot +Y-down → three.js +Y-up: y is negated (see node2dTransform).
    expect(group.position.x).toBeCloseTo(50, 5);
    expect(group.position.y).toBeCloseTo(30, 5);
    renderer.unmount();
  });

  // Base-Node2D parity — visibility inherits down the CanvasItem tree (Godot
  // is_visible_in_tree ANDs the parent chain), so a hidden CanvasModulate hides
  // its subtree (and disables its tint with it), not just its own drawing.
  it('visible=false hides the subtree group', async () => {
    const renderer = await renderCM({ visible: 'false' });
    expect(cmGroup(renderer).visible).toBe(false);
    renderer.unmount();
  });

  it('is visible by default', async () => {
    const renderer = await renderCM();
    expect(cmGroup(renderer).visible).toBe(true);
    renderer.unmount();
  });

  // Base-Node2D parity — z / draw order participates via canvasItemZ(z_index).
  it('z_index places the subtree at its draw-order z band, not a hardcoded 0', async () => {
    const renderer = await renderCM({ z_index: '5' });
    expect(cmGroup(renderer).position.z).toBeCloseTo(5 * Z_INDEX_STEP, 5);
    renderer.unmount();
  });

  // Base-Node2D parity — under a y-sort distributor the rank z (YSortZContext)
  // IS the draw position, so the subtree sorts like a sprite sibling.
  it('adopts the y-sort rank z when placed under a distributor', async () => {
    const rankZ = 0.037;
    const renderer = await renderCM({ z_index: '5' }, (kid) => (
      <YSortZProvider value={rankZ}>{kid}</YSortZProvider>
    ));
    expect(cmGroup(renderer).position.z).toBeCloseTo(rankZ, 5);
    renderer.unmount();
  });
});
