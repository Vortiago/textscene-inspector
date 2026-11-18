import { describe, expect, it } from 'vitest';
import { needsMaterialSweep } from './materialScope.mjs';

describe('needsMaterialSweep', () => {
  it('runs for a change to the generator', () => {
    for (const path of [
      'packages/textscene-core/src/shaders/material/renderModes.ts',
      'packages/textscene-core/src/godot/rendering/materials/materialFeatures.ts',
      'packages/textscene-core/src/godot/scene/baseMaterial3D.ts',
    ]) {
      expect(needsMaterialSweep([path])).toBe(true);
    }
  });

  it('runs for a change to the sweep or its digests', () => {
    for (const path of [
      'scripts/godot-probes/materialTexts.mjs',
      'scripts/godot-probes/answerDigest.mjs',
      'apps/textscene-three-godot-shaders/tests/materials/materialTexts.test.mjs',
      'apps/textscene-three-godot-shaders/tests/godotAnswers.mjs',
    ]) {
      expect(needsMaterialSweep([path])).toBe(true);
    }
  });

  it('runs for a change to the image that holds Godot', () => {
    expect(needsMaterialSweep(['.github/ci-image/Dockerfile'])).toBe(true);
  });

  it('skips a change to the translator alone', () => {
    expect(
      needsMaterialSweep([
        'packages/textscene-core/src/shaders/language/parser.ts',
        'apps/textscene-three-godot-shaders/tests/probes/probes.mjs',
        'apps/textscene-three-godot-shaders/tests/godot-answers.json',
        'scripts/godot-probes/record.mjs',
      ])
    ).toBe(false);
  });

  it('runs for an empty diff, which is more likely a broken checkout (edge case)', () => {
    expect(needsMaterialSweep([])).toBe(true);
  });
});
