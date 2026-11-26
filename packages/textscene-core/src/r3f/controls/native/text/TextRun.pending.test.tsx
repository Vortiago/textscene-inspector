/**
 * A run of the bundled face counts as a pending load while the outlines it draws from load, so a
 * capture waits for the glyphs. Each test imports fresh modules: the outlines load once per module.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { TRIANGLE_OUTLINES } from '../testing/triangleOutlines';
import { settleFontWork } from '../../../testing/settleFontWork';
import type { SettledFonts } from './settledFonts';
import type { SfntOutlines } from './sfntOutlines';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

/**
 * Fresh modules, whose outlines of the bundled font load only when `loadOutlines` runs.
 * `mountBundledRun` shapes with the bundled face, and `mountCanvasRun` with a scene font, which
 * carries all it draws with.
 */
async function freshTextModules() {
  vi.resetModules();
  // The one load of the outlines, in the store of the preview that peeks it, as the real peek loads them.
  const outlinesLoad = {};
  let deliverOutlines = (_outlines: SfntOutlines) => {};
  const outlines = new Promise<SfntOutlines>((resolve) => (deliverOutlines = resolve));
  vi.doMock('./sceneFontOutlines', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    peekOutlines: (fonts: SettledFonts) => fonts.peekOutlines(outlinesLoad, () => outlines),
  }));
  const [{ TextRun }, { shapeText }, { ResourceLoader }, { ResourceLoaderProvider }, runtime, probes] =
    await Promise.all([
      import('./TextRun'),
      import('./textLayout'),
      import('../../../../resources/ResourceLoader'),
      import('../../../../resources/ResourceLoaderContext'),
      import('./runtimeFontMetrics'),
      import('../../../../resources/testing/pendingProbe'),
    ]);
  /** Hands the outlines over, and waits until the load has woken the runs that read it. */
  const loader = new ResourceLoader();
  const { Probe, pending, work } = probes.createPendingProbe();
  const loadOutlines = () => {
    deliverOutlines(TRIANGLE_OUTLINES);
    return settleFontWork(work().fonts);
  };
  const mount = (fontMetrics?: ReturnType<typeof runtime.createRuntimeFontMetrics>) => {
    const layout = shapeText('AB', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 3,
      fontMetrics,
    });
    return ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={loader}>
        <Probe />
        <TextRun layout={layout} fontSizePx={16} tint={WHITE} />
      </ResourceLoaderProvider>
    );
  };
  const mountCanvasRun = () =>
    mount(
      runtime.createRuntimeFontMetrics({
        hasGlyph: () => true,
        scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
        measureWidthUnits: (text) => text.length * 500,
        cssFontFamily: 'scene-font-pending-test',
      })
    );
  return { pending, mountBundledRun: () => mount(), mountCanvasRun, loadOutlines };
}

afterEach(() => vi.doUnmock('./sceneFontOutlines'));

// Each test imports the text modules cold (1.8 s alone). Beside a tree-scanning test, the 5 s default fails them.
const FRESH_IMPORT_TIMEOUT_MS = 20_000;

describe('<TextRun> pending load', { timeout: FRESH_IMPORT_TIMEOUT_MS }, () => {
  it('counts a run of the bundled face as pending until its outlines load, then draws it', async () => {
    const { pending, mountBundledRun, loadOutlines } = await freshTextModules();
    const renderer = await mountBundledRun();
    expect(pending()).toBe(1);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);

    await ReactThreeTestRenderer.act(loadOutlines);

    expect(pending()).toBe(0);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('counts a canvas run as nothing, since it carries all it draws with (edge case)', async () => {
    const { pending, mountCanvasRun } = await freshTextModules();
    await mountCanvasRun();

    expect(pending()).toBe(0);
  });

  it('releases the load when the run unmounts before the outlines load (error path)', async () => {
    const { pending, mountBundledRun } = await freshTextModules();
    const renderer = await mountBundledRun();

    await renderer.unmount();

    expect(pending()).toBe(0);
  });
});
