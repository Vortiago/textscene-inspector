import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types';
import { ProjectSettingsProvider } from '../../../r3f/contexts/ProjectSettingsContext';
import { createOpenSansCanvasFontMetrics } from '../../../r3f/controls/native/text/openSansCanvasFontMetrics';
import type { CanvasFontMetrics } from '../../../r3f/controls/native/text/runtimeFontMetrics';
import { clearSceneFontOutlines } from '../../../r3f/controls/native/text/sceneFontOutlines';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { useLabel3DFont } from './useLabel3DFont';

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
  heldPaths: readonly string[] = [],
  hasOutline = false
) {
  return renderHook(() => useLabel3DFont(fontRef, hasOutline), {
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

beforeEach(() => {
  bundled.metrics = createOpenSansCanvasFontMetrics('label3d-font-test');
  clearSceneFontOutlines();
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

    await settle();

    expect(result.current?.metrics).toMatchObject({ kind: 'canvas', embolden: 1 });
  });

  it('takes the embolden of the project default font when the label has no font', async () => {
    const { result } = renderMetrics(undefined, PROJECT_FONT_FILES);

    await settle();

    expect(result.current?.metrics).toMatchObject({ kind: 'canvas', embolden: 2 });
  });

  it('prefers the label font to the project default font', async () => {
    const { result } = renderMetrics('SubResource("own")', PROJECT_FONT_FILES);

    await settle();

    expect(result.current?.metrics).toMatchObject({ kind: 'canvas', embolden: 1 });
  });

  it('is undefined while the project font loads', async () => {
    const { result } = renderMetrics(undefined, PROJECT_FONT_FILES, ['res://bold.tres']);

    await settle();

    expect(result.current).toBeUndefined();
  });
});

describe('useLabel3DFont outlines', () => {
  it('reads no outlines for a label without an outline', async () => {
    const { result } = renderMetrics('SubResource("own")');

    await settle();

    expect(result.current?.outlines).toBeNull();
  });

  it('reads no outlines for an outlined label whose font is not emboldened', async () => {
    const { result } = renderMetrics(undefined, {}, [], true);

    await settle();

    expect(result.current?.outlines).toBeNull();
  });

  it.each([
    ['emboldened', 'own'],
    ['sheared', 'sheared'],
  ])(
    'is undefined, then holds the outlines of the bundled font, for a %s label with an outline',
    async (_name, id) => {
      const { result } = renderMetrics(`SubResource("${id}")`, {}, [], true);

      expect(result.current).toBeUndefined();

      // The bundled font's bytes load as their own chunk, so a fixed count of ticks can end before they arrive.
      await vi.waitFor(() =>
        expect(result.current?.outlines?.glyphIndex('A'.codePointAt(0)!)).toBeGreaterThan(0)
      );
    }
  );
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
