import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as logger from '../logger';
import { ProjectSettingsProvider } from '../r3f/contexts/ProjectSettingsContext';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { NO_PROJECT_FONTS } from './fonts/font/projectFonts';
import { loaderServing } from './testing/servingResourceLoader';
import { useProjectFonts } from './useProjectFonts';

const PROJECT_GODOT = [
  'config_version=5',
  '',
  '[gui]',
  '',
  'theme/custom="res://ui_theme.tres"',
  'theme/custom_font="res://body_font.tres"',
  '',
].join('\n');

const FILES: Record<string, string> = {
  'res://project.godot': PROJECT_GODOT,
  'res://ui_theme.tres': '[gd_resource type="Theme" format=3]\n\n[resource]\ndefault_font_size = 30\n',
  'res://body_font.tres': '[gd_resource type="FontVariation" format=3]\n\n[resource]\nspacing_glyph = 3\n',
};

function renderProjectFonts(files: Record<string, string>, isNeeded = true) {
  const loader = loaderServing(files);
  const rendered = renderHook(() => useProjectFonts(isNeeded), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={loader}>
        <ProjectSettingsProvider sceneKey="res://scene.tscn">{children}</ProjectSettingsProvider>
      </ResourceLoaderProvider>
    ),
  });
  return { loader, ...rendered };
}

async function settle() {
  await act(async () => {
    for (let pass = 0; pass < 6; pass++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useProjectFonts', () => {
  it('loads the theme and the font that project.godot names', async () => {
    const { result } = renderProjectFonts(FILES);

    await settle();

    expect(result.current.projectFonts.projectTheme?.defaultFontSize).toBe(30);
    expect(result.current.projectFonts.projectDefaultFont).toMatchObject({
      kind: 'variation',
      properties: { spacing_glyph: '3' },
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('gives no project fonts for a project that names neither file', async () => {
    const { result } = renderProjectFonts({ 'res://project.godot': 'config_version=5\n' });

    await settle();

    expect(result.current).toEqual({ projectFonts: NO_PROJECT_FONTS, isLoading: false });
  });

  it('gives the other file when one of the two fails to load', async () => {
    const { result } = renderProjectFonts({ ...FILES, 'res://ui_theme.tres': '' });

    await settle();

    expect(result.current.projectFonts.projectTheme).toBeNull();
    expect(result.current.projectFonts.projectDefaultFont).not.toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('warns once that the project font failed, and draws the bundled font', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { result, rerender } = renderProjectFonts({ ...FILES, 'res://body_font.tres': '' });

    await settle();
    rerender();

    expect(result.current.projectFonts.projectDefaultFont).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('res://body_font.tres');
    warn.mockRestore();
  });

  it('answers no project fonts until project.godot has loaded', () => {
    const { result } = renderProjectFonts(FILES);

    expect(result.current).toEqual({ projectFonts: NO_PROJECT_FONTS, isLoading: false });
  });

  it('requests no file for a caller that reads no font', async () => {
    const { loader, result } = renderProjectFonts(FILES, false);

    await settle();

    expect(result.current).toEqual({ projectFonts: NO_PROJECT_FONTS, isLoading: false });
    expect(loader.fonts.isCached('res://body_font.tres')).toBe(false);
    expect(loader.themes.isCached('res://ui_theme.tres')).toBe(false);
  });

  it('follows project.godot when it names another font', async () => {
    const files: Record<string, string> = {
      ...FILES,
      'res://second_font.tres': FILES['res://body_font.tres']!.replace('= 3', '= 7'),
    };
    const { loader, result } = renderProjectFonts(files);
    await settle();

    files['res://project.godot'] = PROJECT_GODOT.replace('body_font', 'second_font');
    loader.fileEventBus!.invalidate('res://project.godot');
    await settle();

    expect(result.current.projectFonts.projectDefaultFont).toMatchObject({
      properties: { spacing_glyph: '7' },
    });
  });
});
