/**
 * A text run counts as a pending load while the glyph atlas it samples has not decoded, so a
 * capture waits for the glyphs. Each test imports fresh modules: the atlas loads once per module.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

/** Fresh modules whose atlas image decodes only when the returned `decode` runs. */
async function freshTextModules() {
  vi.resetModules();
  const onLoads: Array<() => void> = [];
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
    const texture = new THREE.Texture<HTMLImageElement>();
    onLoads.push(() => onLoad?.(texture));
    return texture;
  });
  const [{ TextRun }, { shapeText, AutowrapMode }, { ResourceLoader }, { ResourceLoaderContext }, runtime] =
    await Promise.all([
      import('./TextRun'),
      import('./textLayout'),
      import('../../../../resources/ResourceLoader'),
      import('../../../../resources/ResourceLoaderContext'),
      import('./runtimeFontMetrics'),
    ]);
  const loader = new ResourceLoader();
  const layout = (fontMetrics?: ReturnType<typeof runtime.createRuntimeFontMetrics>) =>
    shapeText('AB', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
      fontMetrics,
    });
  const mount = (fontMetrics?: ReturnType<typeof runtime.createRuntimeFontMetrics>) =>
    ReactThreeTestRenderer.create(
      <ResourceLoaderContext.Provider value={loader}>
        <TextRun layout={layout(fontMetrics)} fontSizePx={16} tint={WHITE} />
      </ResourceLoaderContext.Provider>
    );
  const canvasMetrics = () =>
    runtime.createRuntimeFontMetrics({
      scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
      measureWidthUnits: (text) => text.length * 500,
      cssFontFamily: 'scene-font-pending-test',
    });
  return { loader, mount, canvasMetrics, decode: () => onLoads.forEach((load) => load()) };
}

afterEach(() => vi.restoreAllMocks());

describe('<TextRun> pending load', () => {
  it('counts an atlas run as pending until the atlas decodes', async () => {
    const { loader, mount, decode } = await freshTextModules();
    await mount();
    expect(loader.pendingResourceCount).toBe(1);

    await ReactThreeTestRenderer.act(async () => decode());

    expect(loader.pendingResourceCount).toBe(0);
  });

  it('counts a canvas run as nothing, since it owns its texture (edge case)', async () => {
    const { loader, mount, canvasMetrics } = await freshTextModules();
    await mount(canvasMetrics());

    expect(loader.pendingResourceCount).toBe(0);
  });

  it('releases the load when the run unmounts before the decode (error path)', async () => {
    const { loader, mount } = await freshTextModules();
    const renderer = await mount();

    await renderer.unmount();

    expect(loader.pendingResourceCount).toBe(0);
  });
});
