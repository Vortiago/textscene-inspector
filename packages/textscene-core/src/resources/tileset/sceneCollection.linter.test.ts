/**
 * `TileSetScenesCollectionSource` keys: `scenes/<id>/scene` and `scenes/<id>/display_placeholder`
 * (tile_set.cpp:5864-5892, :5906-5917).
 */

import { describe, expect, it } from 'vitest';
import { expectDiagnostic } from './testing/tileSetScene.js';
import { lint, node, packedScene, scene, subResource } from '../../linter/testing/testkit.js';
import '../../linter/index';

const sceneSource = (key: string, value: string): string =>
  scene(
    packedScene,
    subResource('TileSetScenesCollectionSource', { [key]: value }),
    node('Node3D', {}, { name: 'Root' })
  );

describe('TileSetScenesCollectionSource linter', () => {
  it.each([
    ['scenes/1/scene', 'ExtResource("1_body")'],
    ['scenes/0/display_placeholder', 'true'],
    ['scenes/+3/scene', 'ExtResource("1_body")'],
  ])('accepts %s', (key, value) => {
    expect(lint(sceneSource(key, value))).toEqual([]);
  });

  it('refuses a non-boolean display_placeholder', () => {
    expectDiagnostic(sceneSource('scenes/1/display_placeholder', '"yes"'), {
      severity: 'error',
      contains: ['display_placeholder'],
    });
  });

  it('refuses a negative scene id, which Godot re-assigns', () => {
    expectDiagnostic(sceneSource('scenes/-1/scene', 'ExtResource("1_body")'), {
      severity: 'error',
      contains: ['-1', 'tile_set.cpp:5781'],
    });
  });

  it.each(['scenes/x/scene', 'scenes/1/size', 'scenes/1'])('refuses the unknown key %s', (key) => {
    expectDiagnostic(sceneSource(key, 'true'), { severity: 'error', contains: ['Unknown', key] });
  });
});
