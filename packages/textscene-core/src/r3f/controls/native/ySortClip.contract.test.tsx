/**
 * Godot culls every entry of a y-sort with the clip of the sort root (`p_canvas_clip` is the root's
 * `final_clip_owner`, `renderer_canvas_cull.cpp:458`), so a Control a y-sorted entry merges into the
 * sort escapes that entry's `clip_contents`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ControlCanvasLayer } from './ControlCanvasLayer';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { DispatchedScene } from '../../testing/DispatchedScene';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';

import '../../nodes/index';
import '../index';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;
const mounted: Renderer[] = [];
afterEach(async () => {
  for (const renderer of mounted.splice(0)) await renderer.unmount();
});

/** A ScrollContainer that clips, holding a ColorRect larger than it, below a Node2D `Root`. */
function scrollScene(isRootSorted: boolean, isScrollSorted: boolean): string {
  return `[gd_scene format=3]

[node name="Root" type="Node2D"]
y_sort_enabled = ${isRootSorted}

[node name="Scroll" type="ScrollContainer" parent="."]
offset_left = 100.0
offset_top = 100.0
offset_right = 400.0
offset_bottom = 400.0
y_sort_enabled = ${isScrollSorted}

[node name="Content" type="ColorRect" parent="Scroll"]
custom_minimum_size = Vector2(600, 600)
`;
}

/** The clip planes on the mesh the ColorRect `Content` draws, once the clips have settled. */
async function contentClipPlanes(tscn: string): Promise<readonly THREE.Plane[]> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={createSceneGraphFromTscnScene(parsed)}
      workspace="2d"
      loader={fake.loader}
      around={(nodes) => (
        <>
          {nodes}
          <ControlCanvasLayer nodes={parsed.nodes} />
        </>
      )}
    />
  );
  mounted.push(renderer);
  await renderer.advanceFrames(2, 0.016);
  let planes: readonly THREE.Plane[] | undefined;
  renderer.scene.children[0]!.instance.parent!.traverse((object: THREE.Object3D) => {
    if (planes || !(object as THREE.Mesh).isMesh || !isUnderContent(object)) return;
    planes = ((object as THREE.Mesh).material as THREE.Material).clippingPlanes ?? [];
  });
  if (!planes) throw new Error('expected a mesh under Content, found none');
  return planes;
}

function isUnderContent(object: THREE.Object3D): boolean {
  for (let up = object.parent; up; up = up.parent) if (up.name.endsWith(':Content')) return true;
  return false;
}

describe('the clip of a y-sorted entry', () => {
  it('leaves a Control that a y-sorted ScrollContainer merges into the sort unclipped', async () => {
    expect(await contentClipPlanes(scrollScene(true, true))).toHaveLength(0);
  });

  it('clips the content of a ScrollContainer that no outer sort merges', async () => {
    expect(await contentClipPlanes(scrollScene(false, true))).toHaveLength(4);
  });

  it('clips the content of a ScrollContainer that does not sort its own children', async () => {
    expect(await contentClipPlanes(scrollScene(true, false))).toHaveLength(4);
  });
});
