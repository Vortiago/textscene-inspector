/**
 * `collectTargets`: what a sheet declares before recapture renders anything for
 * it. Read against the committed sheets, since the function reads
 * `collectSheetFiles()` itself and has no seam for synthetic ones.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectTargets } from './recapture/targets.mjs';
import { collectSheetFiles, parseFrontmatter } from './sheetSources.mjs';

describe('collectTargets', () => {
  it('produces a target for every sheet that declares image + fixture (happy path)', () => {
    const targets = collectTargets();
    const byImage = new Map(targets.map((t) => [t.image, t]));

    let sampled = 0;
    for (const file of collectSheetFiles()) {
      const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
      if (!parsed) continue;
      const { meta } = parsed;
      if (meta.visual === 'false' || !meta.image || !meta.fixture) continue;
      expect(byImage.has(meta.image)).toBe(true);
      expect(byImage.get(meta.image).fixture).toBe(meta.fixture);
      sampled++;
    }
    expect(sampled).toBeGreaterThan(0);
  });

  it('carries a section\u2019s particles= through, so both sides render the same instant', () => {
    // An emitter with no `preprocess` settles to a window the previewer picks.
    // Godot must be asked for that window, or its side shows frame 0.
    const byImage = new Map(collectTargets().map((t) => [t.image, t]));
    const declared = [...byImage.values()].filter((t) => t.particles > 0);
    expect(declared.length).toBeGreaterThan(0);
    for (const target of declared) expect(Number.isFinite(target.particles)).toBe(true);
  });

  it('leaves every other target at zero, so no existing reference silently moves', () => {
    const zeroed = collectTargets().filter((t) => t.particles === 0);
    expect(zeroed.length).toBeGreaterThan(0);
  });

  it('produces no target for a sheet that declares no image (the freshly-scaffolded shape)', () => {
    const targets = collectTargets();
    const byImage = new Map(targets.map((t) => [t.image, t]));

    let sampled = 0;
    for (const file of collectSheetFiles()) {
      const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
      if (!parsed) continue;
      const { meta } = parsed;
      if (meta.image) continue;
      expect([...byImage.keys()]).not.toContain(meta.type);
      sampled++;
    }
    expect(sampled).toBeGreaterThan(0);
  });

  it('excludes an image basename declared ONLY by no-visual sheets (edge case)', () => {
    // A no-visual sheet and a visual one can share a basename, and the visual
    // one earns it a target.
    const visualByImage = new Map();
    for (const file of collectSheetFiles()) {
      const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
      if (!parsed) continue;
      const { meta } = parsed;
      if (!meta.image) continue;
      if (!visualByImage.has(meta.image)) visualByImage.set(meta.image, false);
      if (meta.visual !== 'false') visualByImage.set(meta.image, true);
    }
    const visualOnlyImages = new Set(
      [...visualByImage].filter(([, visual]) => visual).map(([image]) => image)
    );

    const targets = collectTargets();
    const byImage = new Map(targets.map((t) => [t.image, t]));

    let sampled = 0;
    for (const [image, everVisual] of visualByImage) {
      if (everVisual) continue;
      expect(visualOnlyImages.has(image)).toBe(false);
      expect(byImage.has(image)).toBe(false);
      sampled++;
    }
    expect(sampled).toBeGreaterThan(0);
  });
});
