/**
 * Where a GLB node sits under the instancing scene, which a `visibility_parent` and a lightmap name
 * by the node path Godot gives it, below the Skeleton3D and BoneAttachment3D the importer adds.
 */

import { describe, expect, it } from 'vitest';
import { flattenGlbObjects } from './glbHierarchy';
import { addBoneRig, buildTestGlbGraph } from './glbGraph.testkit';
import { glbNodeLinks } from './glbNodeLinks';
import type { GlbRoot } from './GlbInstanceContext';

const ROOT: GlbRoot = {
  path: 'Model',
  rawProperties: {},
  overrides: [],
  visibilityParent: null,
  hostScenePaths: [],
};

function placePaths(): Record<string, string | null> {
  const glb = buildTestGlbGraph([]);
  addBoneRig(glb);
  const links = glbNodeLinks(glb, flattenGlbObjects(glb), ROOT, undefined);
  return Object.fromEntries(links.map((link) => [link.entry.relPath, link.place.path]));
}

describe('glbNodeLinks', () => {
  it('places a node on a bone in the BoneAttachment3D of the bone', () => {
    expect(placePaths()['Armature/Hip/Sword']).toBe('Model/Armature/Skeleton3D/Hip/Sword');
  });

  it('places a node with no importer level above it at its plain path', () => {
    expect(placePaths()['Armature']).toBe('Model/Armature');
  });

  it('places a bone no BoneAttachment3D follows at its three path', () => {
    expect(placePaths()['Armature/Hip']).toBe('Model/Armature/Hip');
  });
});
