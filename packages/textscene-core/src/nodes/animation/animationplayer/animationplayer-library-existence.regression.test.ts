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
