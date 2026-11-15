/**
 * Fifty CSGPolygon3D nodes sweep along one Curve3D file: its load runs the CSG pass once for every
 * reader, and renders only the readers whose patch changed.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit.js';
import { TscnParser } from '../parser/TscnParser.js';
import { ResourceLoader } from '../resources/ResourceLoader.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { busServing } from '../resources/testing/servingFileBus.js';
import { HierarchyProvider } from './contexts/HierarchyContext.js';
import { useLiveScenePass } from './liveScenePass.js';
import { liveNodePatches } from './liveNodePatches.js';
import * as csgPolygonPaths from '../nodes/3d/csg/csgpolygon3d/csgPolygonPaths.js';
import './nodes/index';

vi.mock('../nodes/3d/csg/csgpolygon3d/csgPolygonPaths.js', { spy: true });

const POLYGONS = 50;

const CURVE_FILE = `[gd_resource type="Curve3D" format=3]

[resource]
_data = {
"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4),
"tilts": PackedFloat32Array(0, 0)
}
point_count = 2
`;

const polygon = (index: number) => `[node name="Sweep${index}" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("Path3D")
path_local = true

[node name="Path3D" type="Path3D" parent="Sweep${index}"]
curve = ExtResource("curve")
`;

const MAIN = `[gd_scene load_steps=2 format=3]

[ext_resource type="Curve3D" path="res://road.tres" id="curve"]

[node name="Root" type="Node3D"]

[node name="Bystander" type="Node3D" parent="."]

${Array.from({ length: POLYGONS }, (_, index) => polygon(index)).join('\n')}`;

/** Enough timer ticks for a file read through the bus, and the run it starts, to finish. */
const SETTLE_TICKS = 5;

async function settle() {
  for (let tick = 0; tick < SETTLE_TICKS; tick++) {
    await act(() => new Promise<void>((resolve) => setTimeout(resolve)));
  }
}

/** A reader of the patch at `path`, counting its renders. */
function Reader({ path, renders }: { path: string; renders: Map<string, number> }) {
  useLiveScenePass(liveNodePatches, path);
  renders.set(path, (renders.get(path) ?? 0) + 1);
  return null;
}

describe('the CSG pass over one curve file', () => {
  it('runs once for the load, and renders only the readers whose patch changed', async () => {
    const { bus, provider } = busServing({ 'res://road.tres': CURVE_FILE });
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);
    const sceneGraph = createSceneGraphFromTscnScene(new TscnParser().parse(MAIN));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
      </HierarchyProvider>
    );
    const renders = new Map<string, number>();
    const paths = ['Root/Bystander', ...Array.from({ length: POLYGONS }, (_, index) => `Root/Sweep${index}`)];
    const runs = vi.mocked(csgPolygonPaths.resolveCsgPolygonPaths);

    render(
      <>
        {paths.map((path) => (
          <Reader key={path} path={path} renders={renders} />
        ))}
      </>,
      { wrapper }
    );
    const runsBeforeLoad = runs.mock.calls.length;
    const rendersBeforeLoad = new Map(renders);
    await settle();

    expect(runs.mock.calls.length - runsBeforeLoad).toBe(1);
    expect(renders.get('Root/Bystander')).toBe(rendersBeforeLoad.get('Root/Bystander'));
    for (let index = 0; index < POLYGONS; index++) {
      const path = `Root/Sweep${index}`;
      expect(renders.get(path), path).toBe(rendersBeforeLoad.get(path)! + 1);
    }
  });
});
