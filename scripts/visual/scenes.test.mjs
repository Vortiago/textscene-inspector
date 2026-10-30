/** The golden-scene manifest: every entry sets only options the capture reads. */
import { describe, expect, it } from 'vitest';
import { GOLDEN_SCENES, SCENE_OPTIONS } from './scenes.mjs';

describe('GOLDEN_SCENES', () => {
  it('sets only options the capture reads, so a misspelt option fails here and not silently', () => {
    const unknown = GOLDEN_SCENES.flatMap((scene) =>
      Object.keys(scene)
        .filter((option) => !SCENE_OPTIONS.includes(option))
        .map((option) => `${scene.name}.${option}`)
    );
    expect(unknown).toEqual([]);
  });

  it("gives settleTimeout as milliseconds past Playwright's default, which is no limit at 0", () => {
    const declared = GOLDEN_SCENES.filter((scene) => 'settleTimeout' in scene);
    expect(declared.length).toBeGreaterThan(0);
    for (const scene of declared) expect(scene.settleTimeout).toBeGreaterThan(30000);
  });
});
