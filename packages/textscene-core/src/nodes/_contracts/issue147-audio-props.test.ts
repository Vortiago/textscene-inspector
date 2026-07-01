/**
 * #147 — AudioStreamPlayer / AudioStreamPlayer2D render parsers drop the audio
 * properties the linter validates.  BEHAVIORAL CONTRACT (RED until the slice ships).
 *
 * Both players register the shared base parser (parseNode / parseNode2D), so every
 * audio property is silently discarded at parse/render time, neither slice has a
 * propertyFormatter (the Inspector shows nothing), and the plain AudioStreamPlayer
 * linter is missing the `bus`/`playing` validators its 2D/3D siblings already have —
 * a parser↔linter divergence.  AudioStreamPlayer3D is the working sibling to mirror.
 *
 * Written through STABLE public surfaces only (TscnParser, nodeRegistry, Linter) so it
 * survives refactors.  Two side-effect imports are load-bearing and MUST stay:
 *   - `../../parser/TscnParser`  transitively registers every node PARSER (nodeRegistry)
 *   - `../../linter/index`       transitively registers every node's LINTER validators
 * Without the linter barrel the bus/playing validators never load and those assertions
 * could never go green — do not remove it.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene, TscnNode } from '../../parser/types';
import { nodeRegistry } from '../../core/NodeRegistry';
import { Linter } from '../../linter/Linter';
import '../../linter/index'; // side-effect: registers every node's linter validators

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found above this test');
}

function flatten(scene: TscnScene): TscnNode[] {
  const out: TscnNode[] = [];
  const walk = (n: TscnNode): void => {
    out.push(n);
    n.children.forEach(walk);
  };
  scene.nodes.forEach(walk);
  return out;
}

function firstOfType(src: string, type: string): TscnNode {
  const node = flatten(new TscnParser().parse(src)).find((n) => n.type === type);
  expect(node, `scene should contain a ${type} node`).toBeDefined();
  return node as TscnNode;
}

function errorsMatching(src: string, re: RegExp): string[] {
  return new Linter()
    .lint(src)
    .filter((d) => d.severity === 'error' && re.test(d.message))
    .map((d) => d.message);
}

// Witnessed real-Godot forms (music.tscn + town_scene.tscn for the plain player; player.tscn for 2D).
const PLAIN_WITNESS = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://music.ogg" id="1_8pjkj"]

[node name="Root" type="Node"]

[node name="Music" type="AudioStreamPlayer" parent="."]
stream = ExtResource("1_8pjkj")
volume_db = -3.0
autoplay = true
bus = &"Ambient"
`;

const TWO_D_WITNESS = `[gd_scene format=3]

[ext_resource type="AudioStream" path="res://jump.ogg" id="5"]

[node name="Root" type="Node2D"]

[node name="Jump" type="AudioStreamPlayer2D" parent="."]
stream = ExtResource("5")
volume_db = -3.0
`;

const BAD_BUS = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Bad" type="AudioStreamPlayer" parent="."]
bus = Master
`;

const GOOD_BUS = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Ok" type="AudioStreamPlayer" parent="."]
bus = "Master"
`;

const BAD_PLAYING = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Bad" type="AudioStreamPlayer" parent="."]
playing = yes
`;

describe('#147 AudioStreamPlayer / AudioStreamPlayer2D audio properties — behavioral contract (RED until shipped)', () => {
  // Criterion 1 — the witnessed AudioStreamPlayer form parses into typed props (no silent drop).
  it('parses AudioStreamPlayer audio properties into typed values', () => {
    const p = firstOfType(PLAIN_WITNESS, 'AudioStreamPlayer').properties as Record<string, unknown>;
    expect(p.volume_db).toBe(-3.0); // parsed float, not undefined / raw string
    expect(p.autoplay).toBe(true); // parsed boolean
    expect(p.stream).toBe('ExtResource("1_8pjkj")'); // stream ref preserved for the resource pipeline
    expect(p.bus).toBe('Ambient'); // StringName &"Ambient" normalized, mirroring the AudioStreamPlayer3D sibling
  });

  // Criterion 1 — the witnessed AudioStreamPlayer2D form parses into typed props.
  it('parses AudioStreamPlayer2D audio properties into typed values', () => {
    const p = firstOfType(TWO_D_WITNESS, 'AudioStreamPlayer2D').properties as Record<string, unknown>;
    expect(p.volume_db).toBe(-3.0);
    expect(p.stream).toBe('ExtResource("5")');
    // Godot AudioStreamPlayer2D.max_distance defaults to 2000 (a finite pixel
    // distance), NOT the 3D sibling's 0/"unlimited" — guard the 3D-copied bug.
    expect(p.max_distance).toBe(2000);
  });

  // Criterion 1 / 4 — the valid witnessed forms lint clean (no false positive on the audio surface).
  it('lints the witnessed valid forms with no false positive on the audio surface', () => {
    const re = /volume_db|autoplay|bus|stream|pitch_scale|playing/i;
    for (const src of [PLAIN_WITNESS, TWO_D_WITNESS]) {
      expect(errorsMatching(src, re), `unexpected audio lint errors in:\n${src}`).toHaveLength(0);
    }
  });

  // Criterion 4 — the plain AudioStreamPlayer gains the `bus` validator (parity with 2D/3D).
  it('flags an invalid bus on the plain AudioStreamPlayer, accepts a valid one', () => {
    expect(
      errorsMatching(BAD_BUS, /bus/i).length,
      'plain AudioStreamPlayer must reject an unquoted bus (missing bus validator)',
    ).toBeGreaterThan(0);
    expect(errorsMatching(GOOD_BUS, /bus/i), 'a valid quoted bus must not be flagged').toHaveLength(0);
  });

  // Criterion 4 — the plain AudioStreamPlayer gains the `playing` validator (parity with 2D/3D).
  it('flags an invalid playing on the plain AudioStreamPlayer', () => {
    expect(
      errorsMatching(BAD_PLAYING, /playing/i).length,
      'plain AudioStreamPlayer must reject a non-boolean playing (missing playing validator)',
    ).toBeGreaterThan(0);
  });

  // Criterion 1 — both slices surface their audio data in the Inspector via a propertyFormatter.
  it('registers a propertyFormatter that surfaces the audio properties for both players', () => {
    const reg = nodeRegistry.getRegistration('AudioStreamPlayer');
    const reg2 = nodeRegistry.getRegistration('AudioStreamPlayer2D');
    expect(reg?.propertyFormatter, 'AudioStreamPlayer must register a propertyFormatter').toBeDefined();
    expect(reg2?.propertyFormatter, 'AudioStreamPlayer2D must register a propertyFormatter').toBeDefined();
    const props = firstOfType(PLAIN_WITNESS, 'AudioStreamPlayer').properties;
    const sections = reg!.propertyFormatter!(props);
    expect(sections.length, 'the formatter should emit at least one inspector section').toBeGreaterThan(0);
    expect(
      /volume|bus|autoplay|stream/.test(JSON.stringify(sections).toLowerCase()),
      'the formatter should surface the audio properties',
    ).toBe(true);

    // The 2D formatter's OUTPUT (not just its presence) must surface the audio
    // surface and render the 2D-specific spatial semantics correctly.
    const props2 = firstOfType(TWO_D_WITNESS, 'AudioStreamPlayer2D').properties;
    const sections2 = reg2!.propertyFormatter!(props2);
    const json2 = JSON.stringify(sections2).toLowerCase();
    expect(sections2.length, 'the 2D formatter should emit at least one inspector section').toBeGreaterThan(0);
    expect(
      /volume|bus|autoplay|stream/.test(json2),
      'the 2D formatter should surface the audio properties',
    ).toBe(true);
    expect(
      json2.includes('unlimited'),
      'AudioStreamPlayer2D max_distance is a finite pixel distance, never the 3D-only "Unlimited"',
    ).toBe(false);
    expect(
      json2.includes('2000.00'),
      'the witnessed AudioStreamPlayer2D (max_distance omitted) should render its 2000 default',
    ).toBe(true);
  });

  // Criterion 2 — a unit fixture reproduces the witnessed form and is wired into the generated manifest.
  it('ships a unit fixture with a plain AudioStreamPlayer that parses to typed props, wired into fixtures.ts', () => {
    const dir = resolve(repoRoot(), 'scenes/fixtures');
    // trailing quote in the match keeps this to the PLAIN player (not AudioStreamPlayer2D/3D).
    const candidates = readdirSync(dir)
      .filter((f) => f.endsWith('.tscn'))
      .filter((f) => /type="AudioStreamPlayer"/.test(readFileSync(resolve(dir, f), 'utf8')));
    expect(candidates.length, 'a scenes/fixtures/*.tscn must contain a plain AudioStreamPlayer').toBeGreaterThan(0);
    const fixture = candidates.find((f) => {
      const p = (firstOfTypeOrNull(readFileSync(resolve(dir, f), 'utf8'), 'AudioStreamPlayer')?.properties ??
        {}) as Record<string, unknown>;
      return typeof p.volume_db === 'number' || typeof p.autoplay === 'boolean';
    });
    expect(fixture, 'a fixture AudioStreamPlayer must expose typed audio props (volume_db/autoplay)').toBeTruthy();
    const manifest = readFileSync(resolve(repoRoot(), 'apps/textscene-web/src/fixtures.ts'), 'utf8');
    expect(
      manifest.includes(fixture as string),
      `fixture ${fixture} must be registered in fixtures.ts — run pnpm generate:fixtures`,
    ).toBe(true);
  });

  // Criterion 3 — co-located parser tests exist for both slices (happy + edge live there).
  it('ships co-located parser tests for both audio slices', () => {
    const base = resolve(repoRoot(), 'packages/textscene-core/src/nodes/audio');
    expect(
      existsSync(resolve(base, 'audiostreamplayer/parser.test.ts')),
      'audiostreamplayer/parser.test.ts missing',
    ).toBe(true);
    expect(
      existsSync(resolve(base, 'audiostreamplayer2d/parser.test.ts')),
      'audiostreamplayer2d/parser.test.ts missing',
    ).toBe(true);
  });
});

function firstOfTypeOrNull(src: string, type: string): TscnNode | null {
  return flatten(new TscnParser().parse(src)).find((n) => n.type === type) ?? null;
}
