/**
 * The parity differ's pure pieces: its arguments, how it addresses a fixture,
 * and what it reports about a pair of images. Rendering needs Godot and a
 * browser.
 */
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import {
  catalogName,
  comparePngs,
  diffAll,
  diffOne,
  parseArgs,
  residueTable,
  resolveFixture,
} from './diff.mjs';
import { join, resolve } from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

function solidPng(width, height, [r, g, b] = [0, 0, 0]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

describe('parseArgs', () => {
  it('collects fixtures and leaves the mean bound unset by default', () => {
    const args = parseArgs(['unit-csg-box.tscn', 'unit-csg-sphere.tscn']);
    expect(args.fixtures).toEqual(['unit-csg-box.tscn', 'unit-csg-sphere.tscn']);
    expect(args.maxMean).toBeNull();
    expect(args.frame).toBe(false);
    expect(args.keep).toBe(false);
  });

  it('reads the mean per-channel bound and the two capture flags', () => {
    const args = parseArgs(['a.tscn', '--max-mean', '1.5', '--frame', '--keep']);
    expect(args.maxMean).toBe(1.5);
    expect(args.frame).toBe(true);
    expect(args.keep).toBe(true);
  });

  it('reads the file the residue table goes to', () => {
    expect(parseArgs(['a.tscn', '--table', 'out/sweep.md']).table).toBe('out/sweep.md');
    expect(parseArgs(['a.tscn']).table).toBeNull();
  });

  it('reads --collisions as a flag that is off by default', () => {
    expect(parseArgs(['a.tscn', '--collisions']).collisions).toBe(true);
    expect(parseArgs(['a.tscn']).collisions).toBe(false);
  });

  it('rejects a table flag with no file (error path)', () => {
    expect(() => parseArgs(['a.tscn', '--table'])).toThrow('--table needs a file path, got "undefined"');
  });

  it('rejects a table flag followed by another flag (error path)', () => {
    expect(() => parseArgs(['a.tscn', '--table', '--keep'])).toThrow(
      '--table needs a file path, got "--keep"'
    );
  });

  it('rejects a mean bound that is not a number', () => {
    expect(() => parseArgs(['a.tscn', '--max-mean', 'loose'])).toThrow(/--max-mean/);
  });

  it('rejects an unknown flag rather than treating it as a fixture', () => {
    expect(() => parseArgs(['a.tscn', '--max', '0.2'])).toThrow(/unknown flag/);
  });
});

describe('resolveFixture', () => {
  it('addresses a bare fixture filename as both a path and a catalog name', () => {
    const target = resolveFixture('unit-plane-mesh.tscn');
    expect(target.scenePath).toBe(`${REPO_ROOT}/scenes/fixtures/unit-plane-mesh.tscn`);
    expect(target.fixtureName).toBe('unit-plane-mesh.tscn');
    expect(target.label).toBe('unit-plane-mesh');
  });

  /**
   * The label names the PNGs a run writes. Two projects in one sweep both
   * holding a `settings_menu.tscn` wrote over each other's images under a bare
   * basename, so the second scene's diff sat under the first scene's name.
   */
  it('keeps a demo scene’s path in its label, so two sweeps cannot collide', () => {
    const target = resolveFixture('scenes/demos/gui/control_gallery/control_gallery.tscn');
    expect(target.label).toBe('demos-gui-control_gallery-control_gallery');
  });

  it('labels a flattened corpus scene by its corpus, so it never shares a fixture label', () => {
    const target = resolveFixture('scenes/isometric/previews/candle_preview.tscn');
    expect(target.fixtureName).toBe('previews/candle_preview.tscn');
    expect(target.label).toBe('isometric-previews-candle_preview');
  });

  it('rejects a file that is not a .tscn', () => {
    expect(() => resolveFixture('unit-plane-mesh.tres')).toThrow(/not a \.tscn/);
  });

  it('rejects a scene that does not exist', () => {
    expect(() => resolveFixture('no-such-scene.tscn')).toThrow(/no such scene/);
  });
});

describe('catalogName', () => {
  it('flattens scenes/fixtures to a bare filename', () => {
    expect(catalogName(`${REPO_ROOT}/scenes/fixtures/unit-plane-mesh.tscn`)).toBe('unit-plane-mesh.tscn');
  });

  it('names an ld-58 scene relative to its project root, as the catalog lists it', () => {
    expect(catalogName(`${REPO_ROOT}/scenes/ld58/Scenes/Hallway/Hallway.tscn`)).toBe(
      'Scenes/Hallway/Hallway.tscn'
    );
  });

  it('names an isometric scene relative to its project root (edge case)', () => {
    expect(catalogName(`${REPO_ROOT}/scenes/isometric/dungeon.tscn`)).toBe('dungeon.tscn');
  });

  it('keeps every other subtree as a path relative to scenes/', () => {
    expect(catalogName(`${REPO_ROOT}/scenes/demos/3d/town/town_scene.tscn`)).toBe(
      'demos/3d/town/town_scene.tscn'
    );
  });

  it('rejects a scene outside scenes/', () => {
    expect(() => catalogName(`${REPO_ROOT}/packages/whatever.tscn`)).toThrow(/outside scenes/);
  });
});

describe('comparePngs', () => {
  it('reports zero for two identical renders', () => {
    const png = solidPng(4, 4, [10, 20, 30]);
    const result = comparePngs(png, png);
    expect(result.changedPixels).toBe(0);
    expect(result.meanChannelError).toBe(0);
    expect(result.maxChannelDelta).toBe(0);
  });

  it('reports a flat shift a perceptual metric would score as zero', () => {
    // The luminance step pixelmatch counts as no difference at all.
    const result = comparePngs(solidPng(10, 10, [93, 99, 110]), solidPng(10, 10, [82, 88, 98]));
    expect(result.changedPct).toBe(100);
    expect(result.maxChannelDelta).toBe(12);
    expect(result.meanChannelError).toBeCloseTo(34 / 3, 6);
  });

  it('counts the pixels past the residue step, which a mean hides', () => {
    const ours = PNG.sync.read(solidPng(10, 10, [50, 50, 50]));
    ours.data[(4 * 10 + 6) * 4] = 59;
    ours.data[0] = 52;
    const result = comparePngs(solidPng(10, 10, [50, 50, 50]), PNG.sync.write(ours));
    expect(result.over).toEqual({ pixels: 1, bounds: { left: 6, top: 4, right: 6, bottom: 4 } });
  });

  it('names both shapes instead of a number when the frames differ in size', () => {
    const result = comparePngs(solidPng(4, 4), solidPng(8, 4));
    expect(result.sizeMismatch).toBe('godot 4x4 vs ours 8x4');
    expect(result.changedPixels).toBeUndefined();
  });
});

describe('diffOne', () => {
  /**
   * `run.mjs` reports the mode it rendered in, and our side captures the same
   * frame: a 2D scene off the 3D canvas is a different rectangle, a SIZE
   * MISMATCH with no number.
   */
  async function askedCanvas2D(mode) {
    const dir = await mkdtemp(join(tmpdir(), 'refdiff-'));
    const godotOut = join(dir, 'g.png');
    await writeFile(godotOut, solidPng(4, 4));
    let asked = null;
    try {
      await diffOne(
        { scenePath: '/x/s.tscn', fixtureName: 's.tscn', label: 's' },
        { frame: false, keep: false },
        {
          render: async () => ({ out: godotOut, mode }),
          capture: async (args) => {
            asked = args;
            return solidPng(4, 4);
          },
          outDir: dir,
        }
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    return asked.canvas2D;
  }

  it('captures our 2D canvas when the engine rendered the scene in 2D', async () => {
    expect(await askedCanvas2D('2d')).toBe(true);
  });

  it('captures our 3D canvas when the engine rendered the scene in 3D', async () => {
    expect(await askedCanvas2D('3d')).toBe(false);
  });

  /** Both sides show collision shapes or neither does, so the pair measures one setting. */
  async function askedCollisions(collisions) {
    const dir = await mkdtemp(join(tmpdir(), 'refdiff-'));
    const godotOut = join(dir, 'g.png');
    await writeFile(godotOut, solidPng(4, 4));
    const asked = {};
    try {
      await diffOne(
        { scenePath: '/x/s.tscn', fixtureName: 's.tscn', label: 's' },
        { frame: false, keep: false, collisions },
        {
          render: async (args) => {
            asked.debugCollisions = args.debugCollisions;
            return { out: godotOut, mode: '2d' };
          },
          capture: async (args) => {
            asked.showCollisions = args.showCollisions;
            return solidPng(4, 4);
          },
          outDir: dir,
        }
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    return asked;
  }

  it('shows collision shapes on both sides when asked', async () => {
    expect(await askedCollisions(true)).toEqual({ debugCollisions: true, showCollisions: true });
  });

  it('shows collision shapes on neither side by default', async () => {
    expect(await askedCollisions(false)).toEqual({ debugCollisions: false, showCollisions: false });
  });

  /**
   * The reference image IS the project-viewport rect, so it already says how
   * big our stage has to be. Without it the capture used a window sized for
   * this repo's own corpus and a 1280x720 project overflowed the stage.
   */
  it('sizes our stage from the reference frame the engine produced', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'refdiff-'));
    const godotOut = join(dir, 'g.png');
    await writeFile(godotOut, solidPng(1280, 720));
    let asked = null;
    try {
      await diffOne(
        { scenePath: '/x/s.tscn', fixtureName: 's.tscn', label: 's' },
        { frame: false, keep: false },
        {
          render: async () => ({ out: godotOut, mode: '2d' }),
          capture: async (args) => {
            asked = args;
            return solidPng(1280, 720);
          },
          outDir: dir,
        }
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    expect(asked.canvas2DFrame).toEqual({ width: 1280, height: 720 });
  });

  /**
   * `run.mjs` refuses a root-window-only viewport setting in the nested arm and
   * names `--mode 2d-root`, so the differ retries there instead of dropping the
   * scene from a batch.
   */
  it('re-renders through the root window when the nested capture refuses', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'refdiff-'));
    const godotOut = join(dir, 'g.png');
    await writeFile(godotOut, solidPng(4, 4));
    const modes = [];
    try {
      await diffOne(
        { scenePath: '/x/s.tscn', fixtureName: 's.tscn', label: 's' },
        { frame: false, keep: false },
        {
          render: async ({ mode }) => {
            modes.push(mode);
            if (mode !== '2d-root') {
              const error = new Error('Refusing to answer: …');
              error.rootOnlyDrift = true;
              throw error;
            }
            return { out: godotOut, mode: '2d' };
          },
          capture: async () => solidPng(4, 4),
          outDir: dir,
        }
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    expect(modes).toEqual(['auto', '2d-root']);
  });

  it('does not retry a failure the root window cannot fix', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'refdiff-'));
    const modes = [];
    try {
      await expect(
        diffOne(
          { scenePath: '/x/s.tscn', fixtureName: 's.tscn', label: 's' },
          { frame: false, keep: false },
          {
            render: async ({ mode }) => {
              modes.push(mode);
              throw new Error('Godot produced no image');
            },
            capture: async () => solidPng(4, 4),
            outDir: dir,
          }
        )
      ).rejects.toThrow('Godot produced no image');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    expect(modes).toEqual(['auto']);
  });
});

describe('diffAll', () => {
  /**
   * One scene the harness cannot render must not take the rest of a sweep with
   * it: the tool is documented as `ref:diff unit-csg-*.tscn`, and a batch that
   * aborts on its fourth scene has measured nothing about the remaining seven.
   */
  it('reports a scene that could not be rendered and keeps going', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'refdiff-'));
    const godotOut = join(dir, 'g.png');
    await writeFile(godotOut, solidPng(4, 4));
    let results;
    try {
      results = await diffAll(
        [
          { scenePath: '/x/a.tscn', fixtureName: 'a.tscn', label: 'a' },
          { scenePath: '/x/b.tscn', fixtureName: 'b.tscn', label: 'b' },
        ],
        { frame: false, keep: false },
        {
          render: async ({ scene }) => {
            if (scene === '/x/a.tscn') throw new Error('Godot produced no image');
            return { out: godotOut, mode: '3d' };
          },
          capture: async () => solidPng(4, 4),
          outDir: dir,
        }
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    expect(results.map((r) => r.label)).toEqual(['a', 'b']);
    expect(results[0].failed).toMatch(/produced no image/);
    expect(results[1].changedPixels).toBe(0);
  });
});

describe('residueTable', () => {
  const measured = {
    label: 'unit-shadow',
    changedPixels: 134,
    maxChannelDelta: 5,
    meanChannelError: 0.0123,
    over: { pixels: 14, bounds: { left: 540, top: 130, right: 560, bottom: 150 } },
  };

  it('gives one row per scene with the numbers the residue rule reads', () => {
    expect(residueTable([measured])).toBe(
      [
        '| Scene | Changed px | Max /255 | Mean /255 | Px over 2/255 | Where |',
        '| --- | --- | --- | --- | --- | --- |',
        '| `unit-shadow` | 134 | 5 | 0.012 | 14 | (540,130) to (560,150) |',
        '',
      ].join('\n')
    );
  });

  it('leaves the place empty for a scene with no pixel past the step', () => {
    const clean = { ...measured, maxChannelDelta: 1, over: { pixels: 0, bounds: null } };
    expect(residueTable([clean])).toContain('| `unit-shadow` | 134 | 1 | 0.012 | 0 |  |');
  });

  it('says why a scene has no numbers (error path)', () => {
    const table = residueTable([
      { label: 'a', failed: 'Godot produced no image' },
      { label: 'b', sizeMismatch: 'godot 4x4 vs ours 8x4' },
    ]);
    expect(table).toContain('| `a` | failed: Godot produced no image |  |  |  |  |');
    expect(table).toContain('| `b` | size mismatch: godot 4x4 vs ours 8x4 |  |  |  |  |');
  });
});
