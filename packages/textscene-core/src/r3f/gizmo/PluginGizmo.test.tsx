/** The gate of a Godot gizmo-plugin gizmo: when it draws, and the look it hands to its parts. */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GizmoLine } from '../components/GizmoLine';
import { GizmoScene, lineMaterials } from '../testing/GizmoScene';
import { godotColorToLinear } from '../godotColor';
import type { GizmoDrawnFor } from '../hooks/useGizmoState';
import { INSTANTIATED_GIZMO_COLOUR } from './gizmoVariant';
import { PluginGizmo, SelectedOnly } from './PluginGizmo';

const SEGMENT = new Float32Array([0, 0, 0, 0, 0, 1]);
const OWN_COLOUR = 0x336699;
const OWN_OPACITY = 0.5;

async function render(options: {
  drawnFor: GizmoDrawnFor;
  selectedPath: string | null;
  instantiated?: boolean;
  showGizmos?: boolean;
}) {
  const { drawnFor, selectedPath, instantiated, showGizmos } = options;
  return ReactThreeTestRenderer.create(
    <GizmoScene
      nodePath="Node"
      selectedPath={selectedPath}
      instantiated={instantiated}
      showGizmos={showGizmos}
    >
      <PluginGizmo drawnFor={drawnFor}>
        <GizmoLine positions={SEGMENT} color={OWN_COLOUR} opacity={OWN_OPACITY} />
      </PluginGizmo>
    </GizmoScene>
  );
}

describe('PluginGizmo', () => {
  it.each([
    ['selected, drawn for every node', 'every-node', 'Node', 1],
    ['unselected, drawn for every node', 'every-node', null, 1],
    ['selected, drawn for the selected node', 'selected-only', 'Node', 1],
    ['unselected, drawn for the selected node', 'selected-only', null, 0],
  ] as const)('mounts %s: %i part(s)', async (_label, drawnFor, selectedPath, expected) => {
    const renderer = await render({ drawnFor, selectedPath });
    expect(lineMaterials(renderer)).toHaveLength(expected);
  });

  it('mounts nothing with the Gizmos toggle off', async () => {
    const renderer = await render({ drawnFor: 'every-node', selectedPath: 'Node', showGizmos: false });
    expect(lineMaterials(renderer)).toHaveLength(0);
  });

  it('gives a selected part its own colour and opacity', async () => {
    const [material] = lineMaterials(await render({ drawnFor: 'every-node', selectedPath: 'Node' }));
    expect([material!.color.getHex(), material!.opacity]).toEqual([OWN_COLOUR, OWN_OPACITY]);
  });

  it('fades an unselected part to 0.3 of its opacity', async () => {
    const [material] = lineMaterials(await render({ drawnFor: 'every-node', selectedPath: null }));
    expect(material!.opacity).toBeCloseTo(OWN_OPACITY * 0.3, 10);
  });

  it('replaces the colour and the opacity of a part inside an instance the edited scene does not own', async () => {
    const [material] = lineMaterials(
      await render({ drawnFor: 'every-node', selectedPath: 'Node', instantiated: true })
    );
    expect([material!.color.toArray(), material!.opacity]).toEqual([
      godotColorToLinear(INSTANTIATED_GIZMO_COLOUR).toArray(),
      INSTANTIATED_GIZMO_COLOUR.a,
    ]);
  });

  it('keeps the colour of a part outside every gate', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GizmoScene nodePath="Node" selectedPath={null} instantiated>
        <GizmoLine positions={SEGMENT} color={OWN_COLOUR} opacity={OWN_OPACITY} />
      </GizmoScene>
    );
    const [material] = lineMaterials(renderer);
    expect([material!.color.getHex(), material!.opacity]).toEqual([OWN_COLOUR, OWN_OPACITY]);
  });
});

describe('SelectedOnly', () => {
  async function render(selectedPath: string | null, gated = true) {
    const part = (
      <SelectedOnly>
        <GizmoLine positions={SEGMENT} />
      </SelectedOnly>
    );
    return ReactThreeTestRenderer.create(
      <GizmoScene nodePath="Node" selectedPath={selectedPath}>
        {gated ? <PluginGizmo drawnFor="every-node">{part}</PluginGizmo> : part}
      </GizmoScene>
    );
  }

  it('mounts its children for the selected node', async () => {
    expect(lineMaterials(await render('Node'))).toHaveLength(1);
  });

  it('mounts nothing for a node that is not selected', async () => {
    expect(lineMaterials(await render(null))).toHaveLength(0);
  });

  it('mounts nothing outside every gate', async () => {
    expect(lineMaterials(await render('Node', false))).toHaveLength(0);
  });
});
