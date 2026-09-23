/** Edge cases of the pure gate helper, beyond `sourceGate.contract.test.ts`. */
import { describe, expect, it } from 'vitest';
import { resolveForwardedContent } from './sourceGate';

const HEADER_ONLY = '[gd_scene load_steps=1 format=3]';

const VALID_TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]
`;

const FULL_TSCN = `[gd_scene load_steps=2 format=3]

[sub_resource type="Plane" id="Plane_1"]
size = Vector2( 1, 1 )

[node name="PlaneRoot" type="Node3D"]
mesh = SubResource("Plane_1")
`;

const VALID_LAST_GOOD = 'last good content';

describe('resolveForwardedContent', () => {
  it('returns lastGood when buffer is header-only tscn with no nodes', () => {
    const result = resolveForwardedContent(HEADER_ONLY, VALID_LAST_GOOD);
    expect(result).toBe(VALID_LAST_GOOD);
  });

  it('returns lastGood when buffer is comments-only', () => {
    const result = resolveForwardedContent('; just a comment', VALID_LAST_GOOD);
    expect(result).toBe(VALID_LAST_GOOD);
  });

  it('returns the buffer when it is valid tscn and lastGood is empty', () => {
    const result = resolveForwardedContent(VALID_TSCN, '');
    expect(result).toBe(VALID_TSCN);
  });

  it('returns empty string when buffer is garbage and lastGood is empty', () => {
    const result = resolveForwardedContent('garbage', '');
    expect(result).toBe('');
  });

  it('returns the buffer when it contains sub_resource + node and lastGood is empty', () => {
    const result = resolveForwardedContent(FULL_TSCN, '');
    expect(result).toBe(FULL_TSCN);
  });
});
