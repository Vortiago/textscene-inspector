/**
 * <Path2D> draws a white polyline gizmo from its Curve2D for every node, in full colour whether or
 * not it is selected (`path_2d.cpp:148`), and degrades to nothing when the curve is absent. The
 * curve sampler is always provided to descendants (covered by the PathFollow2D tests).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnInternalResource } from '../../../parser/types';
import { Path2D } from './Component';
import { parsePath2D } from './parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { GizmoScene, lineOpacities } from '../../../r3f/testing/GizmoScene';
import { useParentPath2DCurve } from '../../../r3f/contexts/Path2DCurveContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { settleLoads } from '../../../r3f/testing/settleLoads';

// A simple 3-point open path: (0,0) → (100,0) → (100,100), zero tangents.
const CURVE: TscnInternalResource = {
  id: 'Curve2D_1',
  type: 'Curve2D',
  data: {
    _data: '{\n"points": PackedVector2Array(0,0,0,0,0,0, 0,0,0,0,100,0, 0,0,0,0,100,100)\n}',
    point_count: '3',
  },
};

function pathNode(name = 'MyPath', props: Record<string, string> = {}): TscnNode {
  return {
    rawProperties: {},
    name,
    type: 'Path2D',
    children: [],
    properties: parsePath2D({ type: 'node', attributes: { type: 'Path2D', name } }, props),
  };
}

async function renderPath(
  selectedPath: string | null,
  props: Record<string, string>,
  internalResources: TscnInternalResource[] = [CURVE],
  showGizmos = true
) {
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={internalResources} externalResources={[]}>
      <GizmoScene nodePath="MyPath" selectedPath={selectedPath} showGizmos={showGizmos}>
        <Path2D node={pathNode('MyPath', props)}>
          <CurveReader />
        </Path2D>
      </GizmoScene>
    </SceneResourcesProvider>
  );
}

/** Publishes the curve its Path2D parent provides, as a PathFollow2D child reads it. */
function CurveReader() {
  const curve = useParentPath2DCurve();
  return <group name="CurveReader" userData={{ hasCurve: curve !== null }} />;
}

function hasCurve(renderer: Awaited<ReturnType<typeof renderPath>>): boolean {
  const reader = renderer.scene.findByProps({ name: 'CurveReader' }).instance;
  return reader.userData['hasCurve'] === true;
}

describe('<Path2D>', () => {
  it.each([
    ['selected', 'MyPath'],
    ['not selected', null],
  ])(
    'draws the curve polyline gizmo in full colour when %s and a curve is present',
    async (_label, selected) => {
      const renderer = await renderPath(selected, { curve: 'SubResource("Curve2D_1")' });
      expect(lineOpacities(renderer)).toEqual([1]);
    }
  );

  it('draws no curve with the Gizmos toggle off, yet still provides it to a PathFollow2D child', async () => {
    const renderer = await renderPath('MyPath', { curve: 'SubResource("Curve2D_1")' }, [CURVE], false);
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

  // `point_count` resizes the list after `_data` loads (curve.cpp:721-737), so a
  // count of 1 leaves a single point and no span to draw.
  it('draws nothing when point_count truncates the curve to one point (edge)', async () => {
    const truncated: TscnInternalResource = { ...CURVE, data: { ...CURVE.data, point_count: '1' } };
    const renderer = await renderPath('MyPath', { curve: 'SubResource("Curve2D_1")' }, [truncated]);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });
});

/** `CURVE` as a `.tres` of its own, the curve a path names with `ExtResource("1")`. */
const CURVE_FILE = `[gd_resource type="Curve2D" format=3]\n\n[resource]\n${Object.entries(CURVE.data)
  .map(([key, value]) => `${key} = ${value}`)
  .join('\n')}\n`;

async function renderPathFromFile() {
  const loader = loaderServing({ 'res://curve.tres': CURVE_FILE });
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider externalResources={[{ id: '1', type: 'Curve2D', path: 'res://curve.tres' }]}>
        <GizmoScene nodePath="MyPath" selectedPath="MyPath" showGizmos>
          <Path2D node={pathNode('MyPath', { curve: 'ExtResource("1")' })}>
            <CurveReader />
          </Path2D>
        </GizmoScene>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await settleLoads();
  return renderer;
}

describe('<Path2D> with its curve in a file', () => {
  it('provides the curve once the file loads', async () => {
    const renderer = await renderPathFromFile();
    expect(hasCurve(renderer)).toBe(true);
  });

  it('draws the curve once the file loads', async () => {
    const renderer = await renderPathFromFile();
    expect(lineOpacities(renderer)).toEqual([1]);
  });
});
