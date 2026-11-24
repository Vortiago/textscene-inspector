/**
 * A 2D canvas orders its frame steps in one place, `runCanvasFrame`, and not through `useFrame`
 * priorities. The root's frame render is the one priority left: it owns the render.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { callSites, isProductionSource, offendingLines, repoPath, walkSources } from '../testing/sourceScan';

const SRC = join(import.meta.dirname, '../..');

const USE_FRAME = /\buseFrame\(/;

/** `path:line` of each `useFrame` call in `sources` that passes a priority. */
function prioritisedFrameCallbacks(sources: ReturnType<typeof walkSources>): string[] {
  return sources.flatMap(({ file, source }) =>
    callSites(source, USE_FRAME)
      .filter(({ args }) => args.length > 1)
      .map(({ line, args }) => `${repoPath(file)}:${line} ${args[1]}`)
  );
}

const lighting2D = walkSources([join(SRC, 'r3f/lighting2d')], isProductionSource);
const stage = walkSources(
  [join(SRC, 'r3f/world2D'), join(SRC, 'r3f/editorView/Canvas2DStage')],
  isProductionSource
);
const viewportPass = walkSources(
  [join(SRC, 'r3f/viewportRender')],
  (name, path) => isProductionSource(name, path) && name === 'OffscreenViewportPass.tsx'
);

describe('the 2D canvas frame steps', () => {
  it('finds the sources, so the scan cannot pass vacuously', () => {
    expect(lighting2D.length).toBeGreaterThan(20);
    expect(stage.map(({ file }) => repoPath(file))).toContain(
      'packages/textscene-core/src/r3f/world2D/CanvasFrameRender.tsx'
    );
    expect(viewportPass).toHaveLength(1);
  });

  it('give no lighting step a frame priority of its own', () => {
    expect(prioritisedFrameCallbacks(lighting2D)).toEqual([]);
  });

  it('leave the stage one frame priority: the frame render that owns the render', () => {
    expect(prioritisedFrameCallbacks(stage)).toEqual([
      expect.stringMatching(/world2D\/CanvasFrameRender\.tsx:\d+ OWNS_THE_RENDER$/),
    ]);
  });

  it('run a SubViewport light pass only through its canvas frame', () => {
    const source = viewportPass[0]!.source;
    const runs = offendingLines(source, /\brun\.current\b/);
    const lightStep = source.split('\n').findIndex((line: string) => line.includes('steps.lightPass = ')) + 1;
    expect(runs).toEqual([lightStep]);
  });
});
