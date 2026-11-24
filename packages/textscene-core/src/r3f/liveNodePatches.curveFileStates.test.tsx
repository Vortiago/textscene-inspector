import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit.js';
import { TscnParser } from '../parser/TscnParser.js';
import { ResourceLoader } from '../resources/ResourceLoader.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { busServing } from '../resources/testing/servingFileBus.js';
import { HierarchyProvider } from './contexts/HierarchyContext.js';
import { LiveFilesHost } from './LiveFilesHost.js';
import { useLiveScenePass } from './liveScenePass.js';
import { liveNodePatches } from './liveNodePatches.js';
import type { NodePatch } from './nodePatch.js';
import type { CSGPolygon3DResolvedPath } from '../nodes/3d/csg/csgpolygon3d/types.js';
import './nodes/index';

const CURVE_PATH = 'res://road.tres';
const OTHER_PATH = 'res://other.tres';

const curveFile = (endZ: number) => `[gd_resource type="Curve3D" format=3]

[resource]
_data = {
"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ${endZ}),
"tilts": PackedFloat32Array(0, 0)
}
point_count = 2
`;

const MAIN = `[gd_scene load_steps=2 format=3]

[ext_resource type="Curve3D" path="${CURVE_PATH}" id="curve"]

[node name="Root" type="Node3D"]

[node name="Sweep" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("Path3D")
path_local = true

[node name="Path3D" type="Path3D" parent="Sweep"]
curve = ExtResource("curve")
`;

/** Enough timer ticks for a file read through the bus, and the run it starts, to finish. */
const SETTLE_TICKS = 5;

async function settle() {
  for (let tick = 0; tick < SETTLE_TICKS; tick++) {
    await act(() => new Promise<void>((resolve) => setTimeout(resolve)));
  }
}

/** The preview over `files`, with what the reader of the polygon's patch saw. */
function preview(files: Record<string, string>) {
  const { bus, provider } = busServing(files);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  const sceneGraph = createSceneGraphFromTscnScene(new TscnParser().parse(MAIN));
  const seen: { patch: NodePatch | undefined } = { patch: undefined };
  function Reader() {
    seen.patch = useLiveScenePass(liveNodePatches, 'Root/Sweep');
    return null;
  }
  render(
    <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
      <ResourceLoaderProvider loader={loader}>
        <LiveFilesHost />
        <Reader />
      </ResourceLoaderProvider>
    </HierarchyProvider>
  );
  const endOfSweep = () => {
    const resolved = seen.patch?.resolvedPath as CSGPolygon3DResolvedPath | undefined;
    return resolved?.curvePoints.at(-1)?.position.z;
  };
  return { loader, files, seen, endOfSweep };
}

describe('a CSGPolygon3D over a Curve3D file', () => {
  it('sweeps the edited curve once the file reloads', async () => {
    const shown = preview({ [CURVE_PATH]: curveFile(-4) });
    await settle();

    shown.files[CURVE_PATH] = curveFile(-9);
    act(() => shown.loader.resources.clearCache(CURVE_PATH));
    await settle();

    expect(shown.endOfSweep()).toBe(-9);
  });

  it('keeps its patch object for an edit of a file it never read', async () => {
    const shown = preview({ [CURVE_PATH]: curveFile(-4), [OTHER_PATH]: curveFile(-1) });
    await settle();
    act(() => shown.loader.resources.request(OTHER_PATH));
    await settle();
    const before = shown.seen.patch;

    shown.files[OTHER_PATH] = curveFile(-2);
    act(() => shown.loader.resources.clearCache(OTHER_PATH));
    await settle();

    expect(shown.seen.patch).toBe(before);
    expect(shown.endOfSweep()).toBe(-4);
  });

  it('builds nothing for a missing file', async () => {
    const shown = preview({});
    await settle();

    expect(shown.seen.patch).toBeUndefined();
  });

  it('builds nothing for a file that does not parse', async () => {
    const shown = preview({ [CURVE_PATH]: 'not a resource file' });
    await settle();

    expect(shown.seen.patch).toBeUndefined();
  });
});
