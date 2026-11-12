/**
 * The vendored-icon hooks read the project's theme scale themselves, so every painter gets the icon
 * at the pixels Godot rasterises it with and no call site passes the scale.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { THEME_ICON_RASTERS } from './themeIconRasters.generated';
import { CHECK_BOX_ICONS } from './themeIcons';
import { scaledSvgDataUrl } from './scaledSvgIcon';
import { useIconTexture, useNodeIcon } from './useIconTexture';

const project = vi.hoisted(() => ({ themeScale: 1 }));

vi.mock('../../contexts/ProjectSettingsContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../contexts/ProjectSettingsContext')>()),
  useProjectSettings: () => ({ themeScale: project.themeScale }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  project.themeScale = 1;
});

function loadedUrl(render: () => unknown): string {
  const load = vi.spyOn(THREE.TextureLoader.prototype, 'load');
  renderHook(render);
  return load.mock.calls[0]![0];
}

describe('the vendored icon hooks', () => {
  it('load the raster Godot draws at theme scale 1', () => {
    expect(loadedUrl(() => useIconTexture(CHECK_BOX_ICONS.checked))).toBe(THEME_ICON_RASTERS.checked);
  });

  it('load the scaled SVG at theme scale 1.5, in useNodeIcon too', () => {
    project.themeScale = 1.5;

    expect(loadedUrl(() => useIconTexture(CHECK_BOX_ICONS.checked))).toBe(
      scaledSvgDataUrl(CHECK_BOX_ICONS.checked, 1.5)
    );
    expect(loadedUrl(() => useNodeIcon(undefined, CHECK_BOX_ICONS.checked))).toBe(
      scaledSvgDataUrl(CHECK_BOX_ICONS.checked, 1.5)
    );
  });
});
