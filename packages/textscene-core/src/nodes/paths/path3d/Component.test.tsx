/**
 * <Path3D> draws a white polyline gizmo from its Curve3D for every node, faint while unselected
 * (`path_3d_editor_plugin.cpp:320`), and degrades to nothing when the curve is absent.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnInternalResource } from '../../../parser/types';
import { Path3D } from './Component';
import { parsePath3D } from './parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { GizmoScene, lineOpacities } from '../../../r3f/testing/GizmoScene';
import {
  describeGizmoToggle,
  describeInstantiatedGizmo,
  type GizmoNodeCase,
} from '../../../r3f/testing/gizmoContract';
import { useParentPath3DCurve } from '../../../r3f/contexts/Path3DCurveContext';

// Straight 3-point path: (0,0,0) → (10,0,0) → (10,10,0), zero tangents.
const CURVE: TscnInternalResource = {
  id: 'Curve3D_1',
  type: 'Curve3D',
  data: {
    _data:
      '{\n"points": PackedVector3Array(0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,10,0,0, 0,0,0,0,0,0,10,10,0),\n"tilts": PackedFloat32Array(0, 0, 0)\n}',
  },
};

function pathNode(name = 'MyPath', props: Record<string, string> = {}): TscnNode {
  return {
    rawProperties: {},
    name,
    type: 'Path3D',
    children: [],
    properties: parsePath3D({ type: 'node', attributes: { type: 'Path3D', name } }, props),
  };
}

async function renderPath(
  selectedPath: string | null,
  props: Record<string, string>,
  internalResources: TscnInternalResource[] = [CURVE],
  showGizmos = true,
  instantiated = false
) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources} externalResources={[]}>
      <GizmoScene
        nodePath="MyPath"
        selectedPath={selectedPath}
        showGizmos={showGizmos}
        instantiated={instantiated}
      >
        <Path3D node={pathNode('MyPath', props)}>
          <CurveReader />
        </Path3D>
      </GizmoScene>
    </SceneResourcesProvider>
  );
}

/** Publishes the curve its Path3D parent provides, as a PathFollow3D child reads it. */
function CurveReader() {
  const curve = useParentPath3DCurve();
  return <group name="CurveReader" userData={{ hasCurve: curve !== null }} />;
}

function hasCurve(renderer: Awaited<ReturnType<typeof renderPath>>): boolean {
  const reader = renderer.scene.findByProps({ name: 'CurveReader' }).instance;
  return reader.userData['hasCurve'] === true;
}

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: 'MyPath',
  drawnFor: 'every-node',
  mount: ({ selectedPath, showGizmos, instantiated }) =>
    renderPath(selectedPath, { curve: 'SubResource("Curve3D_1")' }, [CURVE], showGizmos, instantiated),
};
describeGizmoToggle('<Path3D>', GIZMO_CASE);
describeInstantiatedGizmo('<Path3D>', GIZMO_CASE);

describe('<Path3D>', () => {
  it('draws the curve polyline gizmo in full colour when selected and a curve is present', async () => {
    const renderer = await renderPath('MyPath', { curve: 'SubResource("Curve3D_1")' });
    expect(lineOpacities(renderer)).toEqual([1]);
  });

  it.each([
    ['nothing is selected', null],
    ['another node is selected', 'Other'],
  ])('draws the curve faintly, at 0.3, when %s', async (_label, selectedPath) => {
    const renderer = await renderPath(selectedPath, { curve: 'SubResource("Curve3D_1")' });
    expect(lineOpacities(renderer)).toEqual([0.3]);
  });

  it('draws no curve with the Gizmos toggle off, yet still provides it to a PathFollow3D child', async () => {
    const renderer = await renderPath('MyPath', { curve: 'SubResource("Curve3D_1")' }, [CURVE], false);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
    expect(hasCurve(renderer)).toBe(true);
  });

  it('draws nothing when the curve is missing, even if selected (edge)', async () => {
    const renderer = await renderPath('MyPath', {});
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws nothing when the curve SubResource is not found (edge)', async () => {
    const renderer = await renderPath('MyPath', { curve: 'SubResource("Missing")' }, []);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  // `point_count` resizes the list after `_data` loads (curve.cpp:1448-1464), so a
  // count of 1 leaves a single point and no span to draw.
  it('draws nothing when point_count truncates the curve to one point (edge)', async () => {
    const truncated: TscnInternalResource = { ...CURVE, data: { ...CURVE.data, point_count: '1' } };
    const renderer = await renderPath('MyPath', { curve: 'SubResource("Curve3D_1")' }, [truncated]);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });
});
