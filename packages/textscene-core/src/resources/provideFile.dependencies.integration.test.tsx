/**
 * A Theme holds its resolved fonts, and a Font its `base_font`, inside its own cached
 * value. `provideFile` on the font file must therefore reload the Theme or Font that
 * read it, with only that reader mounted.
 */
import { describe, it } from 'vitest';
import type { FontResource, FontVariationResource } from './fonts/font/types';
import type { ThemeResource } from './styles/theme/types';
import { createHotReloadHarness, expectShown, mountProbe, provide } from './testing/hotReloadHarness';

/** A FontVariation whose `spacing_glyph` marks its version, over an optional `base_font` file. */
function fontVariation(spacing: number, baseFont?: string): string {
  const ext = baseFont ? `[ext_resource type="Font" path="${baseFont}" id="1"]\n\n` : '';
  const base = baseFont ? 'base_font = ExtResource("1")\n' : '';
  return `[gd_resource type="FontVariation" format=3]\n\n${ext}[resource]\n${base}spacing_glyph = ${spacing}\n`;
}

function themeWithFont(fontPath: string): string {
  return `[gd_resource type="Theme" format=3]\n\n[ext_resource type="Font" path="${fontPath}" id="1"]\n\n[resource]\ndefault_font = ExtResource("1")\n`;
}

/** A Theme whose default font is a FontVariation declared inside the Theme's own file. */
function themeWithInlineFont(baseFontPath: string): string {
  return [
    '[gd_resource type="Theme" format=3]',
    '',
    `[ext_resource type="Font" path="${baseFontPath}" id="1"]`,
    '',
    '[sub_resource type="FontVariation" id="FontVariation_x"]',
    'base_font = ExtResource("1")',
    '',
    '[resource]',
    'default_font = SubResource("FontVariation_x")',
    '',
  ].join('\n');
}

const spacingOf = (font: FontResource | null): string =>
  font?.kind === 'variation' ? (font.properties.spacing_glyph ?? 'unset') : 'none';
const themeFont = (theme: ThemeResource) => spacingOf(theme.defaultFont);
const themeFontBase = (theme: ThemeResource) =>
  spacingOf((theme.defaultFont as FontVariationResource | null)?.baseFont ?? null);
const fontBase = (font: FontVariationResource) => spacingOf(font.baseFont);

describe('provideFile reaches the resources that read the changed file', () => {
  it('reloads a Theme each time its font file changes, since each reload records the read again', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write('res://ui.tres', themeWithFont('res://body.tres'));
    provider.write('res://body.tres', fontVariation(1));
    const shown = mountProbe(loader, { path: 'res://ui.tres', type: 'theme', read: themeFont });
    await expectShown(shown, '1');
    provider.write('res://body.tres', fontVariation(2));
    provide(loader, 'res://body.tres');
    await expectShown(shown, '2');

    provider.write('res://body.tres', fontVariation(3));
    provide(loader, 'res://body.tres');

    await expectShown(shown, '3');
  });

  it('reloads a Theme whose inline font’s base font file changes', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write('res://ui.tres', themeWithInlineFont('res://base.tres'));
    provider.write('res://base.tres', fontVariation(1));
    const shown = mountProbe(loader, { path: 'res://ui.tres', type: 'theme', read: themeFontBase });
    await expectShown(shown, '1');

    provider.write('res://base.tres', fontVariation(2));
    provide(loader, 'res://base.tres');

    await expectShown(shown, '2');
  });

  it('reloads a Font when its base font file changes', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write('res://bold.tres', fontVariation(9, 'res://base.tres'));
    provider.write('res://base.tres', fontVariation(1));
    const shown = mountProbe(loader, { path: 'res://bold.tres', type: 'font', read: fontBase });
    await expectShown(shown, '1');

    provider.write('res://base.tres', fontVariation(2));
    provide(loader, 'res://base.tres');

    await expectShown(shown, '2');
  });

  it('reloads a Theme two reads away, through the font between them', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write('res://ui.tres', themeWithFont('res://bold.tres'));
    provider.write('res://bold.tres', fontVariation(9, 'res://base.tres'));
    provider.write('res://base.tres', fontVariation(1));
    const shown = mountProbe(loader, { path: 'res://ui.tres', type: 'theme', read: themeFontBase });
    await expectShown(shown, '1');

    provider.write('res://base.tres', fontVariation(2));
    provide(loader, 'res://base.tres');

    await expectShown(shown, '2');
  });

  it('settles when two fonts read each other', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write('res://a.tres', fontVariation(1, 'res://b.tres'));
    provider.write('res://b.tres', fontVariation(5, 'res://a.tres'));
    const shown = mountProbe(loader, { path: 'res://a.tres', type: 'font', read: fontBase });
    await expectShown(shown, '5');

    provider.write('res://b.tres', fontVariation(6, 'res://a.tres'));
    provide(loader, 'res://b.tres');

    await expectShown(shown, '6');
  });

  it('reloads a Theme that loaded while its font was missing, once the font arrives', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write('res://ui.tres', themeWithFont('res://body.tres'));
    const shown = mountProbe(loader, { path: 'res://ui.tres', type: 'theme', read: themeFont });
    await expectShown(shown, 'none');

    provider.write('res://body.tres', fontVariation(1));
    provide(loader, 'res://body.tres');

    await expectShown(shown, '1');
  });

  it('settles a Theme on the new font when the font changes while the Theme is still loading', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write('res://ui.tres', themeWithFont('res://body.tres'));
    provider.write('res://body.tres', fontVariation(1));
    provider.hold('res://body.tres');
    const shown = mountProbe(loader, { path: 'res://ui.tres', type: 'theme', read: themeFont });
    await expectShown(shown, 'pending');

    provider.write('res://body.tres', fontVariation(2));
    provide(loader, 'res://body.tres');
    provider.release('res://body.tres');

    await expectShown(shown, '2');
  });
});
