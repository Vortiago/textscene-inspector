/**
 * Tests for AudioStreamPlayer semantic linter rules.
 *
 * Mirrors the AudioStreamPlayer2D/3D semantic rules for the non-positional
 * AudioStreamPlayer, minus the positional ones (max_distance / attenuation).
 * A streamless player is VALID (the stream can be set at runtime), so it is
 * NOT an error; the advisory cases (autoplay with no stream, extreme volume)
 * are WARNINGS — which the bulk fixtureLint guard allows. Only a dangling
 * stream reference is an error. (Format validation of volume_db / pitch_scale
 * / max_polyphony types already lives in linterParser.ts.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('AudioStreamPlayer semantic rules', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a player whose stream resolves and values are normal', () => {
    const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_a"]

[node name="Player" type="AudioStreamPlayer"]
stream = ExtResource("1_a")
volume_db = 0.0
pitch_scale = 1.0
`;

    expect(linter.lint(content)).toHaveLength(0);
  });

  it('does NOT error on a streamless player (stream may be set at runtime)', () => {
    const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
volume_db = 0.0
`;

    const diagnostics = linter.lint(content);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
  });

  it('errors when the stream reference does not resolve', () => {
    const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
stream = ExtResource("9_missing")
`;

    const diagnostics = linter.lint(content);
    const err = diagnostics.find((d) => d.ruleName === 'audiostreamplayer-missing-stream-resource');
    expect(err).toBeDefined();
    expect(err!.severity).toBe('error');
    expect(err!.nodeType).toBe('AudioStreamPlayer');
  });

  it('warns when autoplay is on but no stream is set', () => {
    const content = `[gd_scene format=3]

[node name="Player" type="AudioStreamPlayer"]
autoplay = true
`;

    const diagnostics = linter.lint(content);
    const warn = diagnostics.find((d) => d.ruleName === 'audiostreamplayer-autoplay-without-stream');
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe('warning');
  });

  it('warns on an extreme volume_db (stream present)', () => {
    const content = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://sound.ogg" id="1_a"]

[node name="Player" type="AudioStreamPlayer"]
stream = ExtResource("1_a")
volume_db = -100.0
`;

    const diagnostics = linter.lint(content);
    const warn = diagnostics.find((d) => d.ruleName === 'audiostreamplayer-extreme-volume');
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe('warning');
  });
});
