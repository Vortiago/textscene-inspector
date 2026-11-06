import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import type { CanvasFontMetrics } from '../../../r3f/controls/native/text/runtimeFontMetrics';
import { testBitmapMetrics } from '../../../r3f/controls/native/text/bitmapFontMetrics.testkit';
import { withFallbacks } from '../../../r3f/controls/native/text/fontMetrics';

/**
 * The modules under test, imported again after each `vi.resetModules()`: the outlines of the bundled
 * font sit in a module-wide cache, so a test that reads a label's outlines needs the cache empty.
 * One import graph holds the hook and the providers, so their contexts are the same objects.
 */
async function importModules() {
  vi.resetModules();
  const [settings, fontMetrics, resources, loading, serving, hook, noFace] = await Promise.all([
    import('../../../r3f/contexts/ProjectSettingsContext'),
    import('../../../r3f/controls/native/text/openSansCanvasFontMetrics'),
    import('../../../r3f/SceneResourcesContext'),
    import('../../../resources/ResourceLoaderContext'),
    import('../../../resources/testing/servingResourceLoader'),
    import('./useLabel3DFont'),
    import('../../../r3f/controls/native/text/noFaceMetrics'),
  ]);
  return {
    ProjectSettingsProvider: settings.ProjectSettingsProvider,
    createOpenSansCanvasFontMetrics: fontMetrics.createOpenSansCanvasFontMetrics,
    SceneResourcesProvider: resources.SceneResourcesProvider,
    ResourceLoaderProvider: loading.ResourceLoaderProvider,
    loaderServing: serving.loaderServing,
    useLabel3DFont: hook.useLabel3DFont,
    NO_FACE_METRICS: noFace.NO_FACE_METRICS,
  };
}

let modules: Awaited<ReturnType<typeof importModules>>;

// happy-dom has no `FontFace`, so the bundled registration answers what the test sets.
const bundled = vi.hoisted(() => ({ metrics: undefined as CanvasFontMetrics | undefined }));
vi.mock('../../../r3f/controls/native/text/bundledFontLoader', () => ({
  peekBundledCanvasFontMetrics: () => bundled.metrics,
}));

const BOLD_VARIATION =
  '[gd_resource type="FontVariation" format=3]\n\n[resource]\nvariation_embolden = 2.0\n';

/** The project theme's `default_font` is a bare FontVariation, which skips itself and takes the bundled font. */
const PROJECT_FONT_FILES = {
  'res://project.godot': 'config_version=5\n\n[gui]\n\ntheme/custom="res://theme.tres"\n',
  'res://theme.tres':
    '[gd_resource type="Theme" load_steps=2 format=3]\n\n[ext_resource type="FontVariation" path="res://bold.tres" id="1"]\n\n[resource]\ndefault_font = ExtResource("1")\n',
  'res://bold.tres': BOLD_VARIATION,
};

/** A bare FontVariation as `custom_font` is every default it tries, so it draws no face. */
const FACELESS_PROJECT_FILES = {
  'res://project.godot': 'config_version=5\n\n[gui]\n\ntheme/custom_font="res://bold.tres"\n',
  'res://bold.tres': BOLD_VARIATION,
};

const OWN_FONT: TscnInternalResource = {
  id: 'own',
  type: 'FontVariation',
  data: { variation_embolden: '1.0' },
};
const SHEARED_FONT: TscnInternalResource = {
  id: 'sheared',
  type: 'FontVariation',
  data: { variation_transform: 'Transform2D(1, 0.3, 0, 1, 0, 0)' },
};
const PLAIN_FILE: TscnInternalResource = { id: 'plain', type: 'FontFile', data: {} };
const MIPMAPPED_FILE: TscnInternalResource = {
  id: 'mipmapped',
  type: 'FontFile',
  data: { generate_mipmaps: 'true' },
};

function renderMetrics(
  fontRef: string | undefined,
  files: Record<string, string> = {},
  heldPaths: readonly string[] = []
) {
  const {
    ProjectSettingsProvider,
    ResourceLoaderProvider,
    SceneResourcesProvider,
    loaderServing,
    useLabel3DFont,
  } = modules;
  return renderHook(() => useLabel3DFont(fontRef), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider
        loader={loaderServing({ 'res://project.godot': 'config_version=5\n', ...files }, heldPaths)}
      >
        <ProjectSettingsProvider sceneKey="res://scene.tscn">
          <SceneResourcesProvider internalResources={[OWN_FONT, SHEARED_FONT, PLAIN_FILE, MIPMAPPED_FILE]}>
            {children}
          </SceneResourcesProvider>
        </ProjectSettingsProvider>
      </ResourceLoaderProvider>
    ),
  });
}

/**
 * An emboldened face waits for the bundled font's bytes and hinters, which `vi.resetModules` makes
 * each test evaluate again: 140 ms alone, and past the default 1 s under a loaded pre-push run.
 */
const CHUNK_LOAD_TIMEOUT_MS = 5000;

function settledMetrics(
  result: { current: ReturnType<typeof modules.useLabel3DFont> },
  expected: Record<string, unknown>
) {
  return vi.waitFor(() => expect(result.current?.metrics).toMatchObject(expected), {
    timeout: CHUNK_LOAD_TIMEOUT_MS,
  });
}

async function settle() {
  await act(async () => {
    for (let pass = 0; pass < 6; pass++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Settles one throwaway load inside `act`. The settle wakes every reader of the font settle count. */
async function settleThrowawayFontLoad() {
  const { createSettledPeek } = await import('../../../r3f/controls/native/text/settledChannel');
  await act(async () => {
    createSettledPeek<object, null>()({}, async () => null);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// An emboldened face loads the bundled bytes and both hinters as their own chunks: about 230 ms to
// transform cold. Transforming them once here leaves each test only their evaluation.
beforeAll(async () => {
  await Promise.all([
    import('../../../r3f/controls/native/text/bundledFontBytes'),
    import('../../../r3f/controls/native/text/truetype/trueTypeHinting'),
    import('../../../r3f/controls/native/text/autofit/autoHinter'),
  ]);
});

beforeEach(async () => {
  modules = await importModules();
  bundled.metrics = modules.createOpenSansCanvasFontMetrics('label3d-font-test');
});

describe('useLabel3DFont metrics', () => {
  it('is the bundled canvas face for a label with no font in a project with none', async () => {
    const { result } = renderMetrics(undefined);

    await vi.waitFor(() =>
      expect(result.current?.metrics).toMatchObject({ cssFontFamily: bundled.metrics!.cssFontFamily })
    );
  });

  it('is undefined until the bundled font registers', async () => {
    bundled.metrics = undefined;
    const { result } = renderMetrics(undefined);

    await settle();

    expect(result.current).toBeUndefined();
  });

  it('takes the embolden of the label font over the bundled font', async () => {
    const { result } = renderMetrics('SubResource("own")');

    await settledMetrics(result, { kind: 'canvas', embolden: 1 });
  });

  it('takes the embolden of the project default font when the label has no font', async () => {
    const { result } = renderMetrics(undefined, PROJECT_FONT_FILES);

    await settledMetrics(result, { kind: 'canvas', embolden: 2 });
  });

  it('prefers the label font to the project default font', async () => {
    const { result } = renderMetrics('SubResource("own")', PROJECT_FONT_FILES);

    await settledMetrics(result, { kind: 'canvas', embolden: 1 });
  });

  // `label_3d.cpp:344-358, 601-606`: a glyph with no font RID has no texture, and the box holds hex-code boxes.
  it('is the hex-code box metrics for a font with no face, with no wait for the bundled font', async () => {
    bundled.metrics = undefined;
    const { result } = renderMetrics(undefined, FACELESS_PROJECT_FILES);

    await vi.waitFor(() => expect(result.current?.metrics).toBe(modules.NO_FACE_METRICS));
  });

  it('is undefined while the project font loads', async () => {
    const { result } = renderMetrics(undefined, PROJECT_FONT_FILES, ['res://bold.tres']);

    await settle();

    expect(result.current).toBeUndefined();
  });
});

describe('useLabel3DFont outlines', () => {
  afterEach(() => vi.doUnmock('../../../r3f/controls/native/text/sceneFontLoader'));

  // FreeType draws every glyph from its outline (`text_server_adv.cpp:1360-1393`), varied or not.
  it('reads the outlines of the bundled font for a face that is neither emboldened nor sheared', async () => {
    const { result } = renderMetrics(undefined);

    await vi.waitFor(() => expect(result.current?.metrics.outlines).toBeDefined());
  });

  it('is ready, with no outlines, for an unvaried canvas face', async () => {
    // happy-dom has no `FontFace`, so no font file settles to a canvas face unless the loader says so.
    vi.doMock('../../../r3f/controls/native/text/sceneFontLoader', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      peekSettledSceneFontMetrics: () => bundled.metrics,
    }));
    modules = await importModules();
    const { result } = renderMetrics(undefined);

    await settle();

    expect(result.current?.metrics).toBe(bundled.metrics);
  });

  it('is the bitmap face of a BMFont, which draws from its page images and not the bundled font', async () => {
    const bitmap = testBitmapMetrics();
    vi.doMock('../../../r3f/controls/native/text/sceneFontLoader', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      peekSettledSceneFontMetrics: () => bitmap,
    }));
    modules = await importModules();
    const { result } = renderMetrics('SubResource("plain")');

    await settle();

    expect(result.current?.metrics).toBe(bitmap);
  });

  it.each([
    ['emboldened', 'own'],
    ['sheared', 'sheared'],
  ])('is undefined, then holds the outlines of the bundled font, for a %s label', async (_name, id) => {
    const { result } = renderMetrics(`SubResource("${id}")`);

    expect(result.current).toBeUndefined();

    // The bundled font's bytes load as their own chunk, so a fixed count of ticks can end before they arrive.
    await vi.waitFor(
      () => expect(result.current?.metrics.outlines?.glyphIndex('A'.codePointAt(0)!)).toBeGreaterThan(0),
      { timeout: CHUNK_LOAD_TIMEOUT_MS }
    );
  });
});

const PROJECT_MIPMAPS = 'config_version=5\n\n[gui]\n\ntheme/default_font_generate_mipmaps=true\n';

describe('useLabel3DFont mip chain', () => {
  it('follows the project setting for the bundled font', async () => {
    const { result } = renderMetrics(undefined, { 'res://project.godot': PROJECT_MIPMAPS });

    await settle();

    expect(result.current?.generatesMipmaps).toBe(true);
  });

  it('follows the project setting for a FontVariation over the bundled font', async () => {
    const { result } = renderMetrics('SubResource("own")', { 'res://project.godot': PROJECT_MIPMAPS });

    await settle();

    expect(result.current?.generatesMipmaps).toBe(true);
  });

  it('is off for a label font that sets none, whatever the project setting says', async () => {
    const { result } = renderMetrics('SubResource("plain")', { 'res://project.godot': PROJECT_MIPMAPS });

    await settle();

    expect(result.current?.generatesMipmaps).toBe(false);
  });

  it('is on for a label font that sets it, whatever the project setting says', async () => {
    const { result } = renderMetrics('SubResource("mipmapped")');

    await settle();

    expect(result.current?.generatesMipmaps).toBe(true);
  });
});

describe('useLabel3DFont mip chain of a fallback face', () => {
  afterEach(() => vi.doUnmock('../../../r3f/controls/native/text/sceneFontLoader'));

  // Each FontFile builds its own glyph textures, so a fallback keeps its own `generate_mipmaps`.
  it('follows the fallback font, not the label font', async () => {
    const fallback = modules.createOpenSansCanvasFontMetrics('label3d-fallback-test');
    const mipmappedFont = { kind: 'file', fallbacks: [], properties: { generate_mipmaps: 'true' } };
    vi.doMock('../../../r3f/controls/native/text/sceneFontLoader', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      peekSettledSceneFontMetrics: () => withFallbacks(bundled.metrics!, [fallback]),
      peekSettledChainFaces: () => [
        { font: null, metrics: bundled.metrics },
        { font: mipmappedFont, metrics: fallback },
      ],
    }));
    modules = await importModules();
    const { result } = renderMetrics('SubResource("plain")');

    await settle();

    expect(result.current?.generatesMipmaps).toBe(false);
    expect(result.current?.fallbackMipmaps.get(fallback)).toBe(true);
  });

  // `withFallbacks` keeps the first face of the same metrics, so its glyphs draw in that one.
  it('follows the first fallback of the same metrics', async () => {
    const fallback = modules.createOpenSansCanvasFontMetrics('label3d-fallback-test');
    const plainFont = { kind: 'file', fallbacks: [], properties: {} };
    const mipmappedFont = { kind: 'file', fallbacks: [], properties: { generate_mipmaps: 'true' } };
    vi.doMock('../../../r3f/controls/native/text/sceneFontLoader', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      peekSettledSceneFontMetrics: () => withFallbacks(bundled.metrics!, [fallback]),
      peekSettledChainFaces: () => [
        { font: null, metrics: bundled.metrics },
        { font: plainFont, metrics: fallback },
        { font: mipmappedFont, metrics: fallback },
      ],
    }));
    modules = await importModules();
    const { result } = renderMetrics('SubResource("plain")');

    await settle();

    expect(result.current?.fallbackMipmaps.get(fallback)).toBe(false);
  });
});

describe('useLabel3DFont mip chain while a chain face reloads', () => {
  afterEach(() => vi.doUnmock('../../../r3f/controls/native/text/sceneFontLoader'));

  it('draws each fallback face at the label setting', async () => {
    const fallback = modules.createOpenSansCanvasFontMetrics('label3d-reload-test');
    vi.doMock('../../../r3f/controls/native/text/sceneFontLoader', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      peekSettledSceneFontMetrics: () => withFallbacks(bundled.metrics!, [fallback]),
      peekSettledChainFaces: () => null,
    }));
    modules = await importModules();
    const { result } = renderMetrics('SubResource("mipmapped")');

    await settle();

    // The project sets none, so a fallback drawn at the project setting would lose the label's mip chain.
    expect(result.current?.generatesMipmaps).toBe(true);
    expect(result.current?.fallbackMipmaps.has(fallback)).toBe(false);
  });

  it('reads the mip chain of each fallback face once the chain face settles', async () => {
    const fallback = modules.createOpenSansCanvasFontMetrics('label3d-reload-settle-test');
    const mipmappedFont = { kind: 'file', fallbacks: [], properties: { generate_mipmaps: 'true' } };
    const chain = { faces: null as readonly object[] | null };
    vi.doMock('../../../r3f/controls/native/text/sceneFontLoader', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      peekSettledSceneFontMetrics: () => withFallbacks(bundled.metrics!, [fallback]),
      peekSettledChainFaces: () => chain.faces,
    }));
    modules = await importModules();
    const { result } = renderMetrics('SubResource("plain")');
    await settle();

    chain.faces = [
      { font: null, metrics: bundled.metrics },
      { font: mipmappedFont, metrics: fallback },
    ];
    await settleThrowawayFontLoad();

    expect(result.current?.fallbackMipmaps.get(fallback)).toBe(true);
  });
});

describe('useLabel3DFont fallbacks of an atlas face', () => {
  afterEach(() => vi.doUnmock('../../../r3f/controls/native/text/sceneFontLoader'));

  it('keeps the fallbacks on the bundled canvas face that draws it', async () => {
    const fallback = modules.createOpenSansCanvasFontMetrics('label3d-atlas-fallback-test');
    const { OPEN_SANS_FONT_METRICS } = await import('../../../r3f/controls/native/text/openSansFontMetrics');
    vi.doMock('../../../r3f/controls/native/text/sceneFontLoader', async (importOriginal) => ({
      ...(await importOriginal<object>()),
      peekSettledSceneFontMetrics: () => withFallbacks(OPEN_SANS_FONT_METRICS, [fallback]),
    }));
    modules = await importModules();
    const { result } = renderMetrics(undefined);

    await settle();

    expect(result.current?.metrics.fallbacks).toEqual([fallback]);
  });
});
