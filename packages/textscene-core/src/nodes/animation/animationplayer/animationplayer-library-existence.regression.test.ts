/**
 * Regression contract for #148 — AnimationPlayer autoplay/current_animation existence checks
 * are DEAD on real Godot 4 files.
 *
 * The semantic linter resolved clip names only from `anims/<name>` keys (pre-4.0) and gated the
 * existence checks on `hasAnimations = some key startsWith('anims/')`. Real Godot 4 stores clips
 * in AnimationLibrary `_data`, referenced via `libraries/`, so the checks never fired — a typo'd
 * `autoplay = &"wlak"` was never flagged on any real scene. The linter also left the StringName
 * `&` marker in (unlike the render parser), so a correct fix must strip it AND must NOT
 * false-positive on a valid clip (render and linter must agree on the resolved clip names).
 *
 * The render-side animationResolver already walks libraries -> _data -> clip names; the linter
 * has the same scene access. These rules are WARNINGS (advisory), not format errors.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

// A library-based AnimationPlayer (the real Godot 4 form): clips live in an AnimationLibrary
// `_data` map with StringName (`&"..."`) keys, referenced via `libraries/`. walk + jump exist.
const libScene = (autoplay = '', current = ''): string =>
  `[gd_scene format=3]

[sub_resource type="Animation" id="Animation_walk"]
length = 1.0

[sub_resource type="Animation" id="Animation_jump"]
length = 1.0

[sub_resource type="AnimationLibrary" id="AnimationLibrary_1"]
_data = {
&"walk": SubResource("Animation_walk"),
&"jump": SubResource("Animation_jump")
}

[node name="AnimPlayer" type="AnimationPlayer"]
libraries/ = SubResource("AnimationLibrary_1")
${autoplay ? `autoplay = ${autoplay}\n` : ''}${current ? `current_animation = ${current}\n` : ''}`;

const rules = (d: { ruleName?: string }[]) => d.map((x) => x.ruleName);

describe('#148 AnimationPlayer existence checks on library-based (Godot 4) scenes', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  it('flags autoplay referencing a clip absent from the AnimationLibrary', () => {
    // "wlak" is a typo — only walk/jump exist in the library.
    expect(rules(linter.lint(libScene('&"wlak"')))).toContain('animationplayer-autoplay-missing');
  });

  it('flags current_animation referencing a clip absent from the AnimationLibrary', () => {
    expect(rules(linter.lint(libScene('', '&"jmp"')))).toContain(
      'animationplayer-current-animation-missing',
    );
  });

  it('does NOT flag a valid &-prefixed autoplay clip (strips the StringName marker, finds the clip)', () => {
    // walk EXISTS — the `&` must be stripped and the library consulted, else this false-positives.
    expect(rules(linter.lint(libScene('&"walk"')))).not.toContain('animationplayer-autoplay-missing');
  });

  it('does NOT flag a valid &-prefixed current_animation clip', () => {
    expect(rules(linter.lint(libScene('', '&"jump"')))).not.toContain(
      'animationplayer-current-animation-missing',
    );
  });

  // --- regression guards: the legacy anims/ path must keep working unchanged ---

  it('still flags an autoplay typo in the legacy anims/ form', () => {
    const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
anims/walk = SubResource("Animation_1")
autoplay = "wlak"
`;
    expect(rules(linter.lint(content))).toContain('animationplayer-autoplay-missing');
  });

  it('still accepts a valid autoplay in the legacy anims/ form', () => {
    const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
anims/walk = SubResource("Animation_1")
autoplay = "walk"
`;
    expect(rules(linter.lint(content))).not.toContain('animationplayer-autoplay-missing');
  });
});

/**
 * Contract hardening (#148 follow-up): the original RED contract only pinned the empty-name default
 * library with inline SubResource clips. Reviving the existence checks for that one form let two
 * false-positive regressions through — the check is only meaningful when the clip set is FULLY
 * resolvable, and named libraries reference clips as `<lib>/<clip>`. These pin both, plus the
 * dict form, the no-source case, and special-char clip names (linter ↔ renderer agreement).
 */
describe('#148 hardening: existence checks only fire on a fully-resolvable clip set', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  // An ExtResource-backed library points at an external (often binary .res) file the previewer
  // deliberately cannot resolve — so its clips are invisible and NOTHING can be asserted missing.
  const extLibScene = (autoplay = ''): string =>
    `[gd_scene format=3]

[ext_resource type="AnimationLibrary" path="res://anims.res" id="1_lib"]

[node name="AnimPlayer" type="AnimationPlayer"]
libraries/ = ExtResource("1_lib")
${autoplay ? `autoplay = ${autoplay}\n` : ''}`;

  it('does NOT flag autoplay against an UNRESOLVABLE ExtResource library (incomplete clip picture)', () => {
    expect(rules(linter.lint(extLibScene('&"walk"')))).not.toContain('animationplayer-autoplay-missing');
  });

  // A clip in a NAMED library is referenced `<libname>/<clip>` (Godot keys named-library clips by
  // their library), so resolution must carry the prefix — bare-name matching false-positives.
  const namedLibScene = (autoplay = ''): string =>
    `[gd_scene format=3]

[sub_resource type="Animation" id="Animation_walk"]
length = 1.0

[sub_resource type="AnimationLibrary" id="AnimationLibrary_combat"]
_data = {
&"walk": SubResource("Animation_walk")
}

[node name="AnimPlayer" type="AnimationPlayer"]
libraries/combat = SubResource("AnimationLibrary_combat")
${autoplay ? `autoplay = ${autoplay}\n` : ''}`;

  it('does NOT flag a valid named-library clip referenced as <lib>/<clip>', () => {
    expect(rules(linter.lint(namedLibScene('&"combat/walk"')))).not.toContain('animationplayer-autoplay-missing');
  });

  it('STILL flags a typo in a named-library clip', () => {
    expect(rules(linter.lint(namedLibScene('&"combat/wlak"')))).toContain('animationplayer-autoplay-missing');
  });

  // Godot 4's actual serialization is the single `libraries` dict, default library keyed "".
  const dictLibScene = (autoplay = ''): string =>
    `[gd_scene format=3]

[sub_resource type="Animation" id="Animation_walk"]
length = 1.0

[sub_resource type="AnimationLibrary" id="AnimationLibrary_1"]
_data = {
&"walk": SubResource("Animation_walk")
}

[node name="AnimPlayer" type="AnimationPlayer"]
libraries = {
"": SubResource("AnimationLibrary_1")
}
${autoplay ? `autoplay = ${autoplay}\n` : ''}`;

  it('resolves the dict `libraries = { "": … }` form: valid clip not flagged', () => {
    expect(rules(linter.lint(dictLibScene('&"walk"')))).not.toContain('animationplayer-autoplay-missing');
  });

  it('resolves the dict form: a typo IS flagged', () => {
    expect(rules(linter.lint(dictLibScene('&"wlak"')))).toContain('animationplayer-autoplay-missing');
  });

  it('does NOT flag autoplay when NO clip source exists at all (the no-animations warning covers it)', () => {
    const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = &"walk"
`;
    const found = rules(linter.lint(content));
    expect(found).not.toContain('animationplayer-autoplay-missing');
    expect(found).toContain('animationplayer-no-animations'); // pinned: the no-source signal stays the no-animations warning
  });

  // A clip name with a special char (e.g. `:`) must resolve identically in the linter and the render
  // resolver (both key off the `"<name>": SubResource(...)` form) — no false positive, typo still caught.
  const specialClipScene = (autoplay = ''): string =>
    `[gd_scene format=3]

[sub_resource type="Animation" id="Animation_x"]
length = 1.0

[sub_resource type="AnimationLibrary" id="AnimationLibrary_1"]
_data = {
&"ui:open": SubResource("Animation_x")
}

[node name="AnimPlayer" type="AnimationPlayer"]
libraries/ = SubResource("AnimationLibrary_1")
${autoplay ? `autoplay = ${autoplay}\n` : ''}`;

  it('resolves a special-char clip name (linter ↔ renderer agree): valid not flagged, typo flagged', () => {
    expect(rules(linter.lint(specialClipScene('&"ui:open"')))).not.toContain('animationplayer-autoplay-missing');
    expect(rules(linter.lint(specialClipScene('&"ui:shut"')))).toContain('animationplayer-autoplay-missing');
  });

  it('does NOT flag an empty StringName autoplay/current_animation (`&""` = Godot 4 "no clip")', () => {
    // `&""` strips to "" — that's "nothing playing", not a missing clip. Guard on the STRIPPED name.
    expect(rules(linter.lint(libScene('&""')))).not.toContain('animationplayer-autoplay-missing');
    expect(rules(linter.lint(libScene('', '&""')))).not.toContain('animationplayer-current-animation-missing');
  });

  // A library that RESOLVES but is empty (`_data = {}`) is still fully enumerable, so a missing clip
  // IS caught — it must not fall into the unresolvable/no-source suppression.
  const emptyLibScene = (autoplay = ''): string =>
    `[gd_scene format=3]

[sub_resource type="AnimationLibrary" id="AnimationLibrary_empty"]
_data = {}

[node name="AnimPlayer" type="AnimationPlayer"]
libraries/ = SubResource("AnimationLibrary_empty")
${autoplay ? `autoplay = ${autoplay}\n` : ''}`;

  it('flags a missing autoplay against a resolvable-but-EMPTY library (enumerable → truly absent)', () => {
    expect(rules(linter.lint(emptyLibScene('&"walk"')))).toContain('animationplayer-autoplay-missing');
  });
});
