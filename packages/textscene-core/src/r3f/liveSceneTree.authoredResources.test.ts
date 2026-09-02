/**
 * A node the OUTER file grafts into an instance resolves its `instance=` ref
 * against the table it was authored in (`authoredResources`), not the
 * sub-scene's it now sits in — the same scope `DispatchedNode` renders under.
 */
import { describe, expect, it } from 'vitest';
import {
  collectLiveNodes,
  liveNodeChain,
  resolveLiveEntry,
  type LiveTreeContext,
  type CachedSceneSource,
} from './liveSceneTree';
import type { TscnNode, TscnScene, TscnExternalResource } from '../parser/types';

function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  return { name, type, children: [], properties: {}, ...extras };
}

function cacheOf(entries: Record<string, TscnScene>): CachedSceneSource {
  return { getCached: (p) => entries[p] };
}

function ext(id: string, path: string): TscnExternalResource {
  return { id, path, type: 'PackedScene' };
}

// inner.tscn — what the OUTER file's id "2" names.
const innerScene: TscnScene = {
  nodes: [makeNode('InnerRoot', 'Label', { children: [makeNode('Text', 'RichTextLabel')] })],
  externalResources: [],
  internalResources: [],
};

// decoy.tscn — what hud.tscn's OWN id "2" names. Resolving the grafted node
// against the sub-scene table lands here: a plausible wrong answer, not a miss.
const decoyScene: TscnScene = {
  nodes: [makeNode('DecoyRoot', 'Sprite2D')],
  externalResources: [],
  internalResources: [],
};

const hudScene: TscnScene = {
  nodes: [makeNode('HudRoot', 'CanvasLayer', { children: [makeNode('Score', 'Label')] })],
  externalResources: [ext('2', 'res://decoy.tscn')],
  internalResources: [],
};

const ctx: LiveTreeContext = {
  externalResources: [ext('1', 'res://hud.tscn'), ext('2', 'res://inner.tscn')],
  sceneCache: cacheOf({
    'res://hud.tscn': hudScene,
    'res://inner.tscn': innerScene,
    'res://decoy.tscn': decoyScene,
  }),
};

describe('outer-authored instance grafted under an instance', () => {
  // [node name="HudInstance" parent="." instance=ExtResource("1")]
  // [node name="Inner" parent="HudInstance" instance=ExtResource("2")]
  const roots = [
    makeNode('Game', 'Node2D', {
      children: [
        makeNode('HudInstance', 'Node', {
          instance: 'ExtResource("1")',
          children: [makeNode('Inner', 'Node', { instance: 'ExtResource("2")' })],
        }),
      ],
    }),
  ];

  it('resolveLiveEntry collapses it to inner.tscn root, keeping the originating ref', () => {
    const entry = resolveLiveEntry('Game/HudInstance/Inner', roots, ctx);
    expect(entry?.node.type).toBe('Label');
    expect(entry?.instanceRef).toBe('ExtResource("2")');
  });

  it('liveNodeChain carries the collapsed identity at every level', () => {
    const chain = liveNodeChain('Game/HudInstance/Inner/Text', roots, ctx);
    expect(chain?.map((n) => n.type)).toEqual(['Node2D', 'CanvasLayer', 'Label', 'RichTextLabel']);
  });

  it('collectLiveNodes reaches inner.tscn content through the grafted node', () => {
    const found = collectLiveNodes(roots, ctx, (n) => n.type === 'RichTextLabel');
    expect(found.map((e) => e.path)).toEqual(['Game/HudInstance/Inner/Text']);
  });
});

describe('outer-authored instance below a grafted plain node', () => {
  // [node name="Wrapper" parent="HudInstance" type="Node2D"]
  // [node name="Inner" parent="HudInstance/Wrapper" instance=ExtResource("2")]
  const roots = [
    makeNode('Game', 'Node2D', {
      children: [
        makeNode('HudInstance', 'Node', {
          instance: 'ExtResource("1")',
          children: [
            makeNode('Wrapper', 'Node2D', {
              children: [makeNode('Inner', 'Node', { instance: 'ExtResource("2")' })],
            }),
          ],
        }),
      ],
    }),
  ];

  it('inherits the grafted ancestor scope for its own instance ref', () => {
    const entry = resolveLiveEntry('Game/HudInstance/Wrapper/Inner', roots, ctx);
    expect(entry?.node.type).toBe('Label');
    expect(entry?.instanceRef).toBe('ExtResource("2")');
  });

  it('collectLiveNodes descends through the grafted ancestor into inner.tscn', () => {
    const found = collectLiveNodes(roots, ctx, (n) => n.type === 'RichTextLabel');
    expect(found.map((e) => e.path)).toEqual(['Game/HudInstance/Wrapper/Inner/Text']);
  });
});
