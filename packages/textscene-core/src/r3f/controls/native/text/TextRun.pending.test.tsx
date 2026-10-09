/**
 * A text run counts as a pending load while the glyph atlas it samples has not decoded, so a
 * capture waits for the glyphs. Each test imports fresh modules: the atlas loads once per module.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { deferTextureDecodes } from './atlasTexture.testkit';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

/**
 * Fresh modules whose atlas image decodes only when the returned `decode` runs. `mountAtlasRun`
 * shapes with the atlas, and `mountCanvasRun` with a scene font, which paints its own texture.
 */
async function freshTextModules() {
  vi.resetModules();
  const decode = deferTextureDecodes();
  const [{ TextRun }, { shapeText, AutowrapMode }, { ResourceLoader }, { ResourceLoaderContext }, runtime] =
    await Promise.all([
      import('./TextRun'),
      import('./textLayout'),
      import('../../../../resources/ResourceLoader'),
      import('../../../../resources/ResourceLoaderContext'),
      import('./runtimeFontMetrics'),
    ]);
  const loader = new ResourceLoader();
  const mount = (fontMetrics?: ReturnType<typeof runtime.createRuntimeFontMetrics>) => {
    const layout = shapeText('AB', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
      fontMetrics,
    });
    return ReactThreeTestRenderer.create(
      <ResourceLoaderContext.Provider value={loader}>
        <TextRun layout={layout} fontSizePx={16} tint={WHITE} />
      </ResourceLoaderContext.Provider>
    );
  };
  const mountCanvasRun = () =>
    mount(
      runtime.createRuntimeFontMetrics({
        scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
        measureWidthUnits: (text) => text.length * 500,
        cssFontFamily: 'scene-font-pending-test',
      })
    );
  return { loader, mountAtlasRun: () => mount(), mountCanvasRun, decode };
}

afterEach(() => vi.restoreAllMocks());

describe('<TextRun> pending load', () => {
  it('counts an atlas run as pending until the atlas decodes', async () => {
    const { loader, mountAtlasRun, decode } = await freshTextModules();
    await mountAtlasRun();
    expect(loader.pendingResourceCount).toBe(1);

    await ReactThreeTestRenderer.act(async () => decode());

    expect(loader.pendingResourceCount).toBe(0);
  });

  it('counts a canvas run as nothing, since it owns its texture (edge case)', async () => {
    const { loader, mountCanvasRun } = await freshTextModules();
    await mountCanvasRun();

    expect(loader.pendingResourceCount).toBe(0);
  });

  it('releases the load when the run unmounts before the decode (error path)', async () => {
    const { loader, mountAtlasRun } = await freshTextModules();
    const renderer = await mountAtlasRun();

    await renderer.unmount();

    expect(loader.pendingResourceCount).toBe(0);
  });
});
