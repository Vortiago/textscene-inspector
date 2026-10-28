import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import type { CanvasFontMetrics } from '../../../r3f/controls/native/text/runtimeFontMetrics';

/**
 * The modules under test, imported again after each `vi.resetModules()`: the outlines of the bundled
 * font sit in a module-wide cache, so a test that reads a label's outlines needs the cache empty.
 * One import graph holds the hook and the providers, so their contexts are the same objects.
 */
async function importModules() {
  vi.resetModules();
  const [settings, fontMetrics, resources, loading, serving, hook] = await Promise.all([
    import('../../../r3f/contexts/ProjectSettingsContext'),
    import('../../../r3f/controls/native/text/openSansCanvasFontMetrics'),
    import('../../../r3f/SceneResourcesContext'),
    import('../../../resources/ResourceLoaderContext'),
    import('../../../resources/testing/servingResourceLoader'),
    import('./useLabel3DFont'),
  ]);
  return {
    ProjectSettingsProvider: settings.ProjectSettingsProvider,
    createOpenSansCanvasFontMetrics: fontMetrics.createOpenSansCanvasFontMetrics,
    SceneResourcesProvider: resources.SceneResourcesProvider,
    ResourceLoaderProvider: loading.ResourceLoaderProvider,
    loaderServing: serving.loaderServing,
    useLabel3DFont: hook.useLabel3DFont,
  };
}

let modules: Awaited<ReturnType<typeof importModules>>;

// happy-dom has no `FontFace`, so the bundled registration answers what the test sets.
const bundled = vi.hoisted(() => ({ metrics: undefined as CanvasFontMetrics | undefined }));
vi.mock('../../../r3f/controls/native/text/bundledFontLoader', () => ({
  peekBundledCanvasFontMetrics: () => bundled.metrics,
}));

const PROJECT_FONT_FILES = {
  'res://project.godot': 'config_version=5\n\n[gui]\n\ntheme/custom_font="res://bold.tres"\n',
  'res://bold.tres': '[gd_resource type="FontVariation" format=3]\n\n[resource]\nvariation_embolden = 2.0\n',
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

async function settle() {
  await act(async () => {
    for (let pass = 0; pass < 6; pass++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(async () => {
  modules = await importModules();
  bundled.metrics = modules.createOpenSansCanvasFontMetrics('label3d-font-test');
});

describe('useLabel3DFont metrics', () => {
  it('is the bundled canvas metrics for a label with no font in a project with none', async () => {
    const { result } = renderMetrics(undefined);

    await settle();

    expect(result.current?.metrics).toBe(bundled.metrics);
  });

  it('is undefined until the bundled font registers', async () => {
    bundled.metrics = undefined;
    const { result } = renderMetrics(undefined);

    await settle();

    expect(result.current).toBeUndefined();
  });

  it('takes the embolden of the label font over the bundled font', async () => {
    const { result } = renderMetrics('SubResource("own")');

    // An emboldened face waits for the bundled font's bytes, which load as their own chunk.
    await vi.waitFor(() => expect(result.current?.metrics).toMatchObject({ kind: 'canvas', embolden: 1 }));
  });

  it('takes the embolden of the project default font when the label has no font', async () => {
    const { result } = renderMetrics(undefined, PROJECT_FONT_FILES);

    // An emboldened face waits for the bundled font's bytes, which load as their own chunk.
    await vi.waitFor(() => expect(result.current?.metrics).toMatchObject({ kind: 'canvas', embolden: 2 }));
  });

  it('prefers the label font to the project default font', async () => {
    const { result } = renderMetrics('SubResource("own")', PROJECT_FONT_FILES);

    // An emboldened face waits for the bundled font's bytes, which load as their own chunk.
    await vi.waitFor(() => expect(result.current?.metrics).toMatchObject({ kind: 'canvas', embolden: 1 }));
  });

  it('is undefined while the project font loads', async () => {
    const { result } = renderMetrics(undefined, PROJECT_FONT_FILES, ['res://bold.tres']);

    await settle();

    expect(result.current).toBeUndefined();
  });
});

describe('useLabel3DFont outlines', () => {
  it('reads no outlines for a face that is neither emboldened nor sheared', async () => {
    const { result } = renderMetrics(undefined);

    await settle();

    expect(result.current?.metrics.outlines).toBeUndefined();
  });

  it.each([
    ['emboldened', 'own'],
    ['sheared', 'sheared'],
  ])('is undefined, then holds the outlines of the bundled font, for a %s label', async (_name, id) => {
    const { result } = renderMetrics(`SubResource("${id}")`);

    expect(result.current).toBeUndefined();

    // The bundled font's bytes load as their own chunk, so a fixed count of ticks can end before they arrive.
    await vi.waitFor(() =>
      expect(result.current?.metrics.outlines?.glyphIndex('A'.codePointAt(0)!)).toBeGreaterThan(0)
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
