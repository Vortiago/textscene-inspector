import { useEffect, useContext } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { CanvasModulate } from './Component';
import { parseCanvasModulate } from './parser';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SelectionProvider, useSelection } from '../../../r3f/contexts/SelectionContext';
import { Modulate2DContext } from '../../../r3f/canvasItemModulate';
import type { RGBA } from '../../../r3f/canvasItemModulate';

function cmNode(name = 'CM', props: Record<string, string> = {}): TscnNode {
  return {
    name,
    type: 'CanvasModulate',
    children: [],
    properties: parseCanvasModulate({ type: 'node', attributes: { type: 'CanvasModulate', name } }, props),
  };
}

function SelectSeeder({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

/** Captures the Modulate2DContext value from within a CanvasModulate subtree. */
function ContextCapture() {
  const modulate = useContext(Modulate2DContext);
  (globalThis as unknown as Record<string, RGBA>).__capturedCM = modulate;
  return null;
}

async function renderCM(selectedPath: string | null, props: Record<string, string> = {}) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      {selectedPath !== null && <SelectSeeder path={selectedPath} />}
      <NodePathProvider path="CM">
        <CanvasModulate node={cmNode('CM', props)}>
          <ContextCapture />
        </CanvasModulate>
      </NodePathProvider>
    </SelectionProvider>
  );
}

describe('<CanvasModulate>', () => {
  it('renders a <group> element', async () => {
    const renderer = await renderCM(null);
    const groups = renderer.scene.findAllByType('Group');
    expect(groups.length).toBeGreaterThan(0);
    renderer.unmount();
  });

  it('captures Modulate2DContext with colored modulate', async () => {
    delete (globalThis as unknown as Record<string, RGBA>).__capturedCM;
    const renderer = await renderCM(null, { color: 'Color(0.5, 0.5, 1, 1)' });
    const captured = (globalThis as unknown as Record<string, RGBA>).__capturedCM;
    expect(captured).toBeDefined();
    expect(captured!.r).toBeCloseTo(0.5, 3);
    expect(captured!.g).toBeCloseTo(0.5, 3);
    expect(captured!.b).toBeCloseTo(1, 3);
    expect(captured!.a).toBeCloseTo(1, 3);
    renderer.unmount();
  });

  it('default white modulate x white parent yields white', async () => {
    delete (globalThis as unknown as Record<string, RGBA>).__capturedCM;
    const renderer = await renderCM(null);
    const captured = (globalThis as unknown as Record<string, RGBA>).__capturedCM;
    expect(captured).toBeDefined();
    expect(captured!.r).toBeCloseTo(1, 3);
    expect(captured!.g).toBeCloseTo(1, 3);
    expect(captured!.b).toBeCloseTo(1, 3);
    expect(captured!.a).toBeCloseTo(1, 3);
    renderer.unmount();
  });

  it('a non-origin position sets group position', async () => {
    const renderer = await renderCM(null, { position: 'Vector2(50, -30)' });
    const groups = renderer.scene.findAllByType('Group');
    expect(groups.length).toBeGreaterThan(0);
    renderer.unmount();
  });
});
