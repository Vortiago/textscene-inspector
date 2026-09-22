/**
 * `collectTargets` (recapture.mjs) — what a sheet has to declare before
 * recapture has anything to render for it.
 *
 * Read against the REAL committed sheet corpus rather than synthetic fixtures:
 * this function has no seam to inject sheets through (it reads
 * `collectSheetFiles()` itself), and the corpus is exactly the thing whose
 * current, honest state this pins — every sheet with no `image:` key produces
 * no target, which is the other half of the bootstrap deadlock also pinned in
 * parseSections.test.mjs's "build() missing-image failure" (build-gallery
 * fails a build over a DECLARED image with no file, but recapture never even
 * attempts one that isn't declared).
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
    // A CPUParticles emitter with no `preprocess` settles to a window the
    // previewer picks. Godot has to be asked for that same window explicitly,
    // or its side of the pair is frame 0 beside our settled pose.
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
      // Nothing this sheet could plausibly own is a key in the target map,
      // because there is no basename to have keyed it by.
      expect([...byImage.keys()]).not.toContain(meta.type);
      sampled++;
    }
    expect(sampled).toBeGreaterThan(0);
  });

  it('excludes an image basename declared ONLY by no-visual sheets (edge case)', () => {
    // A basename can be shared: a no-visual base slice (Node2D) and a visual
    // one (Area2D) legitimately point at the same fixture image, and the
    // visual sheet's declaration is enough to earn it a target. What must stay
    // excluded is a basename no VISIBLE sheet ever claims.
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
