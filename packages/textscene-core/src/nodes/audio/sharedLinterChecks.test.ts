/**
 * Whether an AnimationMixer audio track drives a node. The scene's tracks are resolved once per
 * tree, whichever player asks first, so a rule called once per player does not repeat a whole-tree
 * walk and every animation parse per call.
 */

import { describe, it, expect } from 'vitest';
import { StrictTscnParser } from '../../linter/StrictTscnParser.js';
import { byName } from '../../linter/testing/sceneNodes.js';
import { audioStream, node, scene } from '../../linter/testing/testkit.js';
import type { TscnScene } from '../../parser/types.js';
import { isDrivenByAnimationAudioTrack } from './sharedLinterChecks.js';

/** An Animation whose one audio track targets `path`, relative to the mixer's root. */
function audioAnimation(path: string): string {
  return `[sub_resource type="Animation" id="anim1"]
tracks/0/type = "audio"
tracks/0/path = NodePath("${path}")
tracks/0/keys = {
"clips": [{
"end_offset": 0.0,
"start_offset": 0.0,
"stream": ExtResource("1_abc")
}],
"times": PackedFloat32Array(0)
}`;
}

const LIBRARY = `[sub_resource type="AnimationLibrary" id="lib"]
_data = {
&"picked": SubResource("anim1")
}`;

function parse(text: string): TscnScene {
  const parsed = new StrictTscnParser().parse(text).scene;
  if (!parsed) throw new Error('the scanner produced no scene');
  return parsed;
}

/** Root, a mixer of `mixerType` under it, and two players: `Pickup` (the track's) and `Other`. */
function drivenScene(mixerType = 'AnimationPlayer', mixerProps: Record<string, string> = {}) {
  return parse(
    scene(
      audioStream,
      audioAnimation('Pickup'),
      LIBRARY,
      node('Node', {}, { name: 'Root' }),
      node(mixerType, { 'libraries/': 'SubResource("lib")', ...mixerProps }, { parent: '.' }),
      node('AudioStreamPlayer', { autoplay: 'true' }, { name: 'Pickup', parent: '.' }),
      node('AudioStreamPlayer', { autoplay: 'true' }, { name: 'Other', parent: '.' })
    )
  );
}

describe('isDrivenByAnimationAudioTrack', () => {
  it('is true for the node an AnimationPlayer audio track targets (happy path)', () => {
    const parsed = drivenScene();
    expect(isDrivenByAnimationAudioTrack(parsed, byName(parsed.nodes, 'Pickup'))).toBe(true);
  });

  it('counts an AnimationTree, which drives audio tracks as any AnimationMixer does', () => {
    const parsed = drivenScene('AnimationTree');
    expect(isDrivenByAnimationAudioTrack(parsed, byName(parsed.nodes, 'Pickup'))).toBe(true);
  });

  it('is false for a node no track targets (error path)', () => {
    const parsed = drivenScene();
    expect(isDrivenByAnimationAudioTrack(parsed, byName(parsed.nodes, 'Other'))).toBe(false);
  });

  it('is false when the mixer root is an authored empty path, which drives nothing (edge case)', () => {
    const parsed = drivenScene('AnimationPlayer', { root_node: 'NodePath("")' });
    expect(isDrivenByAnimationAudioTrack(parsed, byName(parsed.nodes, 'Pickup'))).toBe(false);
  });

  it('is false in a scene with no mixer at all (edge case)', () => {
    const parsed = parse(
      scene(
        node('Node', {}, { name: 'Root' }),
        node('AudioStreamPlayer', { autoplay: 'true' }, { name: 'Pickup', parent: '.' })
      )
    );
    expect(isDrivenByAnimationAudioTrack(parsed, byName(parsed.nodes, 'Pickup'))).toBe(false);
  });

  it('resolves the tracks once per tree, whichever player asks', () => {
    const parsed = drivenScene();
    const mixer = byName(parsed.nodes, 'AnimationPlayer');
    const reads = countPropertyReads(mixer);
    const pickup = byName(parsed.nodes, 'Pickup');
    const other = byName(parsed.nodes, 'Other');

    expect(isDrivenByAnimationAudioTrack(parsed, pickup)).toBe(true);
    const readsForFirstAnswer = reads();
    expect(readsForFirstAnswer).toBeGreaterThan(0);
    for (let i = 0; i < 20; i += 1) {
      expect(isDrivenByAnimationAudioTrack(parsed, other)).toBe(false);
      expect(isDrivenByAnimationAudioTrack(parsed, pickup)).toBe(true);
    }
    expect(reads()).toBe(readsForFirstAnswer);
  });

  it('resolves again against a different resource table for the same tree (edge case)', () => {
    const parsed = drivenScene();
    const pickup = byName(parsed.nodes, 'Pickup');
    expect(isDrivenByAnimationAudioTrack(parsed, pickup)).toBe(true);
    // The same tree with its animations gone: the cached answer must not leak across.
    expect(isDrivenByAnimationAudioTrack({ ...parsed, internalResources: [] }, pickup)).toBe(false);
  });
});

/** Counts reads of `target.properties` from now on. */
function countPropertyReads(target: { properties: unknown }): () => number {
  let reads = 0;
  const properties = target.properties;
  Object.defineProperty(target, 'properties', {
    get: () => {
      reads += 1;
      return properties;
    },
  });
  return () => reads;
}
