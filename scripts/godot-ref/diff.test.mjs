/**
 * Unit tests for the pure pieces of the parity differ. Rendering a scene needs
 * a real Godot and a real browser, so what is testable here is how the tool
 * reads its arguments, how it addresses a fixture, and what it reports about a
 * pair of images — the last one being the whole point of the tool.
 */
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { catalogName, comparePngs, diffAll, diffOne, parseArgs, resolveFixture } from './diff.mjs';
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

  it('rejects a file that is not a .tscn', () => {
    expect(() => resolveFixture('unit-plane-mesh.tres')).toThrow(/not a \.tscn/);
  });

  it('rejects a scene that does not exist', () => {
    expect(() => resolveFixture('no-such-scene.tscn')).toThrow(/no such scene/);
  });
});

describe('catalogName', () => {
  it('flattens scenes/fixtures to a bare filename', () => {
    expect(catalogName(`${REPO_ROOT}/scenes/fixtures/unit-plane-mesh.tscn`)).toBe(
      'unit-plane-mesh.tscn'
    );
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

  it('names both shapes instead of a number when the frames differ in size', () => {
    const result = comparePngs(solidPng(4, 4), solidPng(8, 4));
    expect(result.sizeMismatch).toBe('godot 4x4 vs ours 8x4');
    expect(result.changedPixels).toBeUndefined();
  });
});

describe('diffOne', () => {
  /**
   * The engine decides which of the two frames a scene IS — `run.mjs` reports
   * it back as the mode it rendered in. Our side has to capture the same one:
   * a 2D scene captured off the 3D canvas is a different rectangle, which the
   * differ can only report as SIZE MISMATCH, so every Control scene measured
   * through this tool returned no number at all.
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
   * A project that sets one of the root-window-only viewport settings cannot be
   * answered from the nested capture, and `run.mjs` refuses rather than
   * returning the class default — naming `--mode 2d-root` as the arm that CAN
   * answer. Taking the refusal at its word is the whole remedy, so the differ
   * follows it instead of dropping the scene out of a batch.
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

