/**
 * Unit tests for the pure pieces of the parity differ. Rendering a scene needs
 * a real Godot and a real browser, so what is testable here is how the tool
 * reads its arguments, how it addresses a fixture, and what it reports about a
 * pair of images — the last one being the whole point of the tool.
 */
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { catalogName, comparePngs, parseArgs, resolveFixture } from './diff.mjs';
import { resolve } from 'node:path';

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
