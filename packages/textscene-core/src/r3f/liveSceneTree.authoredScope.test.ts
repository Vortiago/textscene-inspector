/**
 * A node grafted into an instanced sub-scene keeps the scope of the file that authored it.
 * Each reader of the live scene tree resolves the grafted instance ref in that scope, so
 * all of them load the host's scene when both files declare the same ExtResource id.
 */
import { describe, expect, it } from 'vitest';
import { collectLiveNodes, resolveLiveEntry } from './liveSceneTree';
import { collectControlRasterViewports } from '../nodes/viewport/subviewport/controlRasterViewports';
import { resolveInstancePath } from '../resources/SubResourceResolver';
import {
  graftedContext,
  hostScene,
  LEAF_PATH,
  HOST_LEAF_PATH,
  scenesByPath,
} from './testing/graftedScopeFixture';
import { sceneCacheOver } from './liveSceneTree.testkit';
import './nodes/index';

describe('a node grafted into an instanced sub-scene', () => {
  it('collapses into the host scene it names, through the tree walk', () => {
    const found = collectLiveNodes(hostScene.nodes, graftedContext, (node) => node.name === 'Leaf');

    expect(found.map((entry) => [entry.path, entry.node.type])).toEqual([[LEAF_PATH, 'Label']]);
  });

  it('collapses into the host scene it names, through a path lookup', () => {
    expect(resolveLiveEntry(LEAF_PATH, hostScene.nodes, graftedContext)?.node.type).toBe('Label');
  });

  it('hands the raster-viewport scan the host scene’s pool for a grafted sub-viewport', () => {
    const [viewport] = collectControlRasterViewports(hostScene.nodes, sceneCacheOver(scenesByPath), {
      externalResources: hostScene.externalResources,
      internalResources: hostScene.internalResources,
    });

    expect(resolveInstancePath('ExtResource("2")', viewport!.externalResources)).toBe(HOST_LEAF_PATH);
  });
});
