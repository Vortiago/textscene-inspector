/**
 * The contract of `resolveForwardedContent(buffer, lastGood)` (ADR-0020 §3): a buffer the
 * lenient `TscnParser` renders is forwarded, anything else returns `lastGood`. Strict-only lint
 * findings still pass. It is pure and total: no throw on hostile input, no state between calls.
 */
import { describe, expect, it } from 'vitest';
import { resolveForwardedContent } from './sourceGate';

const VALID_TSCN = `[gd_scene load_steps=1 format=3]

[node name="GateRoot" type="Node3D"]
`;

const NEXT_VALID_TSCN = `[gd_scene load_steps=1 format=3]

[node name="GateRootV2" type="Node3D"]
`;

/** Renders under the lenient parser, but a strict pass would complain (unknown property). */
const RENDERS_BUT_LINTY_TSCN = `[gd_scene load_steps=1 format=3]

[node name="LintyRoot" type="Node3D"]
definitely_not_a_godot_property = 42
`;

const GARBAGE = 'this is not a tscn file at all }{ ]] [[';

describe('#201 sourceGate — clean buffer is forwarded', () => {
  it('returns the buffer itself when it parses renderably', () => {
    expect(resolveForwardedContent(VALID_TSCN, '')).toBe(VALID_TSCN);
  });
});

describe('#201 sourceGate — broken buffer retains the previous content', () => {
  it('returns lastGood for plain garbage', () => {
    expect(resolveForwardedContent(GARBAGE, VALID_TSCN)).toBe(VALID_TSCN);
  });

  it('returns lastGood for an empty buffer (mid-edit wipe must not blank the viewport)', () => {
    expect(resolveForwardedContent('', VALID_TSCN)).toBe(VALID_TSCN);
  });

  it('returns lastGood for a heading that never becomes a renderable node', () => {
    // An opened-but-never-valid section is the classic mid-edit transient.
    expect(resolveForwardedContent('[node name="Half', VALID_TSCN)).toBe(VALID_TSCN);
  });
});

describe('#201 sourceGate — gate is the LENIENT parser, not the linter', () => {
  it('forwards a buffer that renders but would not pass a strict lint', () => {
    expect(resolveForwardedContent(RENDERS_BUT_LINTY_TSCN, VALID_TSCN)).toBe(
      RENDERS_BUT_LINTY_TSCN
    );
  });
});

describe('#201 sourceGate — recovers on the next clean edit', () => {
  it('holds through garbage, then forwards the next valid buffer', () => {
    const held = resolveForwardedContent(GARBAGE, VALID_TSCN);
    expect(held).toBe(VALID_TSCN);
    // The next call with a clean buffer forwards it: no failure state sticks.
    expect(resolveForwardedContent(NEXT_VALID_TSCN, held)).toBe(NEXT_VALID_TSCN);
  });
});

describe('#201 sourceGate — total on pathological input', () => {
  it('never throws, and holds lastGood, on hostile non-scene text', () => {
    for (const nasty of ['[', '[]', '[node', '"""', '\u0000\u0000', '   ', '='.repeat(10_000)]) {
      expect(() => resolveForwardedContent(nasty, VALID_TSCN)).not.toThrow();
      expect(resolveForwardedContent(nasty, VALID_TSCN)).toBe(VALID_TSCN);
    }
  });
});
