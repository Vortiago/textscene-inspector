/**
 * A derivation of a live tree runs once for a tree and the answers of the files it read, however
 * many readers ask, and runs again only when a file it read answers differently.
 */

import { describe, expect, it } from 'vitest';
import { ResourceLoader } from '../resources/ResourceLoader';
import { busServing } from '../resources/testing/servingFileBus';
import { loaderSnapshots } from '../resources/reading/loaderSnapshots';
import { nodeReference } from '../resources/reading/scopedReference';
import { namedKind, resourceFile, sceneTables } from '../resources/reading/reading.testkit';
import type { ResourceSnapshot } from '../resources/reading/read';
import { liveTreeResult } from './liveScenePass';
import { liveTreeOfText } from './liveSceneTree.testkit';
import type { LiveTree } from './liveSceneTree';

const A_FILE = 'res://a.tres';
const B_FILE = 'res://b.tres';
const SCENE = sceneTables(`[ext_resource type="Resource" path="${A_FILE}" id="1_a"]`);
const TREE = liveTreeOfText('[gd_scene format=3]\n\n[node name="Root" type="Node"]\n');

/** A source over a loader that serves `a.tres`, and a derivation that reads it, counting its runs. */
function readerOfA() {
  const { bus, provider } = busServing({
    [A_FILE]: resourceFile('resource_name = "a"'),
    [B_FILE]: resourceFile('resource_name = "b"'),
  });
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  const source = loaderSnapshots(loader);
  const { kind } = namedKind();
  let runs = 0;
  const derive = (_tree: LiveTree, snapshot: ResourceSnapshot) => {
    runs++;
    return snapshot.read(nodeReference('ExtResource("1_a")', SCENE), kind);
  };
  return { loader, source, derive, runs: () => runs };
}

/** Lets the loads the loader started finish. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('liveTreeResult', () => {
  it('runs once for fifty readers of one tree and snapshot', () => {
    const { source, derive, runs } = readerOfA();

    const answers = Array.from({ length: 50 }, () => liveTreeResult(derive, TREE, source.current()));

    expect(runs()).toBe(1);
    expect(new Set(answers).size).toBe(1);
  });

  it('runs nothing for a new snapshot on which each of its reads answers the same', async () => {
    const { loader, source, derive, runs } = readerOfA();
    liveTreeResult(derive, TREE, source.current());
    source.request();
    await settle();
    const loaded = liveTreeResult(derive, TREE, source.current());

    loader.resources.request(B_FILE);
    await settle();
    source.restart();

    expect(liveTreeResult(derive, TREE, source.current())).toBe(loaded);
    expect(runs()).toBe(2);
  });

  it('runs again once a file it read loads', async () => {
    const { source, derive, runs } = readerOfA();
    const pending = liveTreeResult(derive, TREE, source.current());
    source.request();
    await settle();

    const loaded = liveTreeResult(derive, TREE, source.current());

    expect(pending.status).toBe('pending');
    expect(loaded.status).toBe('loaded');
    expect(runs()).toBe(2);
  });
});
