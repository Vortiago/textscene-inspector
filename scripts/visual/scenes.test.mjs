/** The golden-scene manifest: every entry sets only options the capture reads. */
import { describe, expect, it } from 'vitest';
import { GOLDEN_SCENES, SCENE_OPTIONS } from './scenes.mjs';
import { CANVAS_2D_SCENES } from './scenes/canvas2d.mjs';
import { CONTROL_TEXT_SCENES } from './scenes/controlText.mjs';
import { CONTROL_WIDGET_SCENES } from './scenes/controlWidgets.mjs';
import { LIGHTING_2D_SCENES } from './scenes/lighting2d.mjs';
import { PARTICLES_2D_SCENES } from './scenes/particles2d.mjs';

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

describe('the 2D chapters', () => {
  const CHAPTERS = [
    { scenes: CONTROL_TEXT_SCENES, prefix: /^(label|rich|text|code|line-edit|lineedit)/ },
    {
      scenes: CONTROL_WIDGET_SCENES,
      prefix: /^(button|check|tab|item|graph|color|progress|split|spin|scroll|control)/,
    },
    { scenes: LIGHTING_2D_SCENES, prefix: /^(pointlight2d|directionallight2d|lightoccluder2d)/ },
    { scenes: PARTICLES_2D_SCENES, prefix: /^cpuparticles2d/ },
  ];

  it('names every golden once, so a split or a merge cannot drop or double a scene', () => {
    const names = GOLDEN_SCENES.map((scene) => scene.name);

    expect(names.filter((name, at) => names.indexOf(name) !== at)).toEqual([]);
  });

  it('keeps each scene in the chapter its name prefix names', () => {
    const misplaced = CHAPTERS.flatMap(({ scenes, prefix }) =>
      scenes.filter((scene) => !prefix.test(scene.name)).map((scene) => scene.name)
    );
    const leftInCanvas = CHAPTERS.flatMap(({ prefix }) =>
      CANVAS_2D_SCENES.filter((scene) => prefix.test(scene.name)).map((scene) => scene.name)
    );

    expect(misplaced).toEqual([]);
    expect(leftInCanvas).toEqual([]);
  });
});
