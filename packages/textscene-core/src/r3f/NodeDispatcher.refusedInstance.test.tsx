/**
 * An instance of a scene that Godot refuses to instantiate renders the magenta placeholder of a
 * failed load, with the node's own children and none of the refused scene, and warns once with
 * the instance path and the refused scene (`packed_scene.cpp:207`, `:232`, `:265`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { NodeDispatcher } from './NodeDispatcher';
import { SceneStack } from './testing/SceneStack';
import { groupNames, magentaCount } from './testing/failedLoadPlaceholders';
import { mainInstancing, TWO_PARENTLESS_ROOTS as TWO_ROOTS } from './liveSceneTree.testkit';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { setLogAdapter, type LogAdapter } from '../logger';

import './nodes/index';
import '../nodes/node/index';
import '../nodes/base/node3d/index';

const HOST = mainInstancing('res://refused.tscn');

async function renderHost(scenes: Record<string, string>) {
  const parse = (text: string) => new TscnParser().parse(text);
  const host = parse(HOST);
  const fake = createFakeResourceLoader();
  for (const [path, text] of Object.entries(scenes)) fake.scenes.seed(path, parse(text));
  return ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={host}>
      <NodeDispatcher nodes={host.nodes} />
    </SceneStack>
  );
}

describe('<NodeDispatcher> an instance of a refused scene', () => {
  afterEach(() => setLogAdapter(null));

  it('draws the node with its own children and a failed-load placeholder, and none of the refused scene', async () => {
    const renderer = await renderHost({ 'res://refused.tscn': TWO_ROOTS });

    expect(groupNames(renderer)).toEqual(expect.arrayContaining(['Body', 'Mark']));
    expect(groupNames(renderer)).not.toContain('One');
    expect(groupNames(renderer)).not.toContain('Two');
    expect(magentaCount(renderer)).toBe(1);
  });

  it('warns once, naming the instance path and the refused scene', async () => {
    const adapter: LogAdapter = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    setLogAdapter(adapter);

    await renderHost({ 'res://refused.tscn': TWO_ROOTS });

    const messages = vi.mocked(adapter.warn).mock.calls.map(([message]) => message);
    expect(
      messages.filter((m) => m.includes('"Main/Body"') && m.includes('res://refused.tscn'))
    ).toHaveLength(1);
  });
});
