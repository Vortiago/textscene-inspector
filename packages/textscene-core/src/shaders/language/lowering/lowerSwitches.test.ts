import { describe, expect, it } from 'vitest';
import { loweredText, text } from './lowering.testkit.js';
import { parseTemplateStage } from '../../template/parseTemplate.js';
import { preprocess } from '../../template/preprocess.js';
import { printTemplateStage } from '../../template/printTemplate.js';
import { variantLines } from '../../template/variant.js';
import { FreshNames } from './freshNames.js';
import { lowerSwitches } from './lowerSwitches.js';

const NO_DEFINES = { general: '', variant: '', custom: [], hasUniforms: false, codeSections: [] };

const SOURCE =
  'int f(int a) { switch (a) { case 1: a = 2; case 2: a = 3; break; default: a = 4; break; } return a; }';

describe('lowerSwitches', () => {
  it('falls from a case into the next, and runs default when no case matches', () => {
    expect(loweredText(lowerSwitches, SOURCE)).toBe(
      text(
        'int f(int a) {',
        [
          '{',
          [
            'int lowered_switch_value_1 = a;',
            'bool lowered_falls_1 = false;',
            'bool lowered_matches_1 = ((lowered_switch_value_1 == 1) || (lowered_switch_value_1 == 2));',
            'while (true) {',
            [
              'if ((lowered_falls_1 || (lowered_switch_value_1 == 1))) {',
              ['(lowered_falls_1 = true);', '{', ['(a = 2);'], '}'],
              '}',
              'if ((lowered_falls_1 || (lowered_switch_value_1 == 2))) {',
              ['(lowered_falls_1 = true);', '{', ['(a = 3);', 'break;'], '}'],
              '}',
              'if ((lowered_falls_1 || !(lowered_matches_1))) {',
              ['(lowered_falls_1 = true);', '{', ['(a = 4);', 'break;'], '}'],
              '}',
              'break;',
            ],
            '}',
          ],
          '}',
          'return a;',
        ],
        '}'
      )
    );
  });

  it('keeps no match flag for a switch without default', () => {
    const lowered = loweredText(
      lowerSwitches,
      'int f(int a) { switch (a) { case 1: a = 2; break; } return a; }'
    );
    expect(lowered).not.toContain('lowered_matches');
  });

  it('runs a default alone when nothing can match', () => {
    const lowered = loweredText(
      lowerSwitches,
      'int f(int a) { switch (a) { default: a = 2; break; } return a; }'
    );
    expect(lowered).toContain('bool lowered_matches_1 = false;');
  });

  it('continues the loop a switch stands in from a label, past the lowered chain', () => {
    const lowered = templateLowered(
      'void main() { int a = 0; while (a < 9) { switch (a) { case 1: a = 2; continue; } a = 9; } }'
    );
    expect(lowered).toMatch(/\(lowered_continues_1 = true\);\s*break;/);
    expect(lowered).toMatch(/if \(lowered_continues_1\) \{\s*continue;/);
  });

  it('leaves a continue of a loop inside a label to that loop', () => {
    const lowered = templateLowered(
      'void main() { int a = 0; switch (a) { case 1: while (a < 9) { a++; continue; } break; } }'
    );
    expect(lowered).not.toContain('lowered_continues');
  });
});

/** A template's `main` with its switches lowered: GLSL, not Godot's text, may continue from a label. */
function templateLowered(text: string): string {
  const lines = text.split('\n').map((line, index) => ({ text: line, file: 't.glsl', line: index + 1 }));
  const stage = parseTemplateStage('compute', preprocess(variantLines(lines, NO_DEFINES)));
  const declarations = stage.declarations.map((part) =>
    part.kind === 'function' ? lowerSwitches(part, new FreshNames(part)) : part
  );
  return printTemplateStage({ ...stage, declarations });
}
