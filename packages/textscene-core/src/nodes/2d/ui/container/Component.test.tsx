/**
 * `<Container>`: a bare Container paints no chrome and lays out no children (`container.cpp`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { Container } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function containerSolveNode(): SolveNode {
  const node: TscnNode = {
    name: 'Wrapper',
    type: 'Container',
    children: [],
    properties: { name: 'Wrapper' },
  };
  return { ...solveNode(), path: 'Wrapper', node };
}

describe('<Container>', () => {
  it('renders no scene objects — a bare Container draws nothing of its own', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Container {...painterEnv()} solveNode={containerSolveNode()} rect={{ x: 0, y: 0, w: 100, h: 40 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});

describe('Container registers no solver', () => {
  it('registers neither a minimum size nor a container layout function', () => {
    expect(controlSolverRegistry.minimumSize('Container')).toBeUndefined();
    expect(controlSolverRegistry.containerLayout('Container')).toBeUndefined();
  });
});

describe('a bare Container imposes no layout on its children', () => {
  it('leaves a child at its own free/anchored rect, unlike a registered container', () => {
    // Full-rect preset (anchors 0,0,1,1, offsets 0): the Container takes the whole 200x100 viewport.
    const containerNode: TscnNode = {
      name: 'Wrapper',
      type: 'Container',
      children: [],
      properties: {
        name: 'Wrapper',
        anchorLeft: 0,
        anchorTop: 0,
        anchorRight: 1,
        anchorBottom: 1,
      },
    };
    const childNode: TscnNode = {
      name: 'Child',
      type: 'Control',
      children: [],
      properties: {
        name: 'Child',
        offsetLeft: 10,
        offsetTop: 20,
        offsetRight: 50,
        offsetBottom: 60,
      },
    };
    const child: SolveNode = { ...solveNode(), path: 'Wrapper/Child', node: childNode };
    const container: SolveNode = { ...solveNode(), path: 'Wrapper', node: containerNode, children: [child] };

    const viewport: Rect2 = { x: 0, y: 0, w: 200, h: 100 };
    const ctx = createSolveContext(nativeTheme(1));
    const solved = solveControlTree([container], viewport, ctx);

    // `Control::_size_changed` (control.cpp:1760-1771): edge_pos[i] = offset[i]
    // + anchor[i] * area. No layout is registered for 'Container', so the child
    // solves against its rect as a free Control.
    expect(solved.get('Wrapper/Child')?.rect).toEqual({ x: 10, y: 20, w: 40, h: 40 });
  });
});
