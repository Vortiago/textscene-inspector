/**
 * AnimationPlayer `autoplay` and `current_animation` existence checks on Godot 4 files, which
 * store clips in AnimationLibrary `_data` through `libraries/`, not in `anims/<name>` keys. The
 * linter strips the StringName `&` marker and resolves the same clip names as the render-side
 * animationResolver, so a valid clip never false-positives. These rules warn.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

// The Godot 4 form: clips live in an AnimationLibrary `_data` map with StringName (`&"..."`)
// keys, referenced through `libraries/`. walk and jump exist.
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
    // "wlak" is a typo: only walk and jump exist in the library.
    expect(rules(linter.lint(libScene('&"wlak"')))).toContain('animationplayer-autoplay-missing');
  });

  it('flags current_animation referencing a clip absent from the AnimationLibrary', () => {
    expect(rules(linter.lint(libScene('', '&"jmp"')))).toContain(
      'animationplayer-current-animation-missing',
    );
  });

  it('does NOT flag a valid &-prefixed autoplay clip (strips the StringName marker, finds the clip)', () => {
    // walk exists: the `&` is stripped and the library consulted, else this false-positives.
    expect(rules(linter.lint(libScene('&"walk"')))).not.toContain('animationplayer-autoplay-missing');
  });

  it('does NOT flag a valid &-prefixed current_animation clip', () => {
    expect(rules(linter.lint(libScene('', '&"jump"')))).not.toContain(
      'animationplayer-current-animation-missing',
    );
  });

  // The legacy `anims/` path keeps working unchanged.

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
 * The existence checks fire only on a fully resolvable clip set, and a named library references
 * clips as `<lib>/<clip>`. These pin both, plus the dict form, the no-source case and
 * special-character clip names, where the linter and the renderer agree.
 */
describe('#148 hardening: existence checks only fire on a fully-resolvable clip set', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  // An ExtResource-backed library points at an external file (often binary `.res`) the previewer
  // does not resolve, so its clips are invisible and no clip can be asserted missing.
  const extLibScene = (autoplay = ''): string =>
    `[gd_scene format=3]

[ext_resource type="AnimationLibrary" path="res://anims.res" id="1_lib"]

[node name="AnimPlayer" type="AnimationPlayer"]
libraries/ = ExtResource("1_lib")
${autoplay ? `autoplay = ${autoplay}\n` : ''}`;

  it('does NOT flag autoplay against an UNRESOLVABLE ExtResource library (incomplete clip picture)', () => {
    expect(rules(linter.lint(extLibScene('&"walk"')))).not.toContain('animationplayer-autoplay-missing');
  });

  // Godot keys a clip in a named library as `<libname>/<clip>`, so resolution carries the
  // prefix. Bare-name matching false-positives.
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

  it('does NOT flag autoplay when NO clip source exists at all (the clip set is unenumerable)', () => {
    const content = `[gd_scene format=3]

[node name="AnimPlayer" type="AnimationPlayer"]
autoplay = &"walk"
`;
    expect(rules(linter.lint(content))).not.toContain('animationplayer-autoplay-missing');
  });

  // A clip name with a special character (for example `:`) resolves identically in the linter and
  // the render resolver, since both key off `"<name>": SubResource(...)`.
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
    // `&""` strips to "", which means nothing is playing, not a missing clip. The guard reads the stripped name.
    expect(rules(linter.lint(libScene('&""')))).not.toContain('animationplayer-autoplay-missing');
    expect(rules(linter.lint(libScene('', '&""')))).not.toContain('animationplayer-current-animation-missing');
  });

  // A library that resolves but is empty (`_data = {}`) is still fully enumerable, so a missing clip
  // is caught rather than suppressed as unresolvable.
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
