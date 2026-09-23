/**
 * Theme decode: one Theme resource body's property bag into typed data. A
 * file-backed `.tres` decodes to `ThemeAddresses`, and an inline Theme straight
 * to a `ThemeResource`, through one shared `scanTheme`. Fonts resolve through the
 * Font slice's own decode (`fonts/font/decode.ts`): one decoder per type.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { unquoteStringName } from '../../../parser/utils';
import { parseOptionalFloat } from '../../../parser/valueParsers';
import { parseColorOrUndefined, type Color } from '../../../utils/colorParser';
import { FONT_SUB_RESOURCE_TYPES, resolveInlineFontResource } from '../../fonts/font/decode';
import type { FontCacheReader } from '../../fonts/font/types';
import { resolveRefToResourcePath, subResourceTypeGate } from '../../subResourcePath';
import type { ScannedTheme, ThemeAddresses, ThemeResource } from './types';
import { indexedKeyRegex } from '../../../godot/index.js';

// Godot splits a theme key with `split("/", true, 2)` (`theme.cpp`), so its
// segments use the shared segment grammar (`indexedKeyGrammar.guard.test.ts`).
// `to_int` names the segment class. Nothing here reads a segment as a number.
/** `<Type>/fonts/<name>`. */
const FONT_ENTRY = indexedKeyRegex(String.raw`^(#)/fonts/(#)$`, 'to_int');
/** `<Type>/font_sizes/<name>`. */
const FONT_SIZE_ENTRY = indexedKeyRegex(String.raw`^(#)/font_sizes/(#)$`, 'to_int');
/** `<Type>/styles/<name>`. */
const STYLE_ENTRY = indexedKeyRegex(String.raw`^(#)/styles/(#)$`, 'to_int');
/** `<Type>/icons/<name>`. */
const ICON_ENTRY = indexedKeyRegex(String.raw`^(#)/icons/(#)$`, 'to_int');
/** `<Type>/colors/<name>`. */
const COLOR_ENTRY = indexedKeyRegex(String.raw`^(#)/colors/(#)$`, 'to_int');
/** `<Type>/constants/<name>`. */
const CONSTANT_ENTRY = indexedKeyRegex(String.raw`^(#)/constants/(#)$`, 'to_int');
/** `<variationType>/base_type`. */
const BASE_TYPE_ENTRY = indexedKeyRegex(String.raw`^(#)/base_type$`, 'to_int');

/**
 * The one `<Type>/<data_type>/<name>` scan (`Theme::_set`/`_get`,
 * `scene/resources/theme.cpp:36-104`). Styles and icons stay raw refs, and
 * colors and constants decode to literals.
 *
 * @param resolveRef Resolves each Font ref: an address for the file-backed path,
 *   a `FontResource` for the inline one. `null` omits the entry, as
 *   `Theme::has_font`'s `Ref<Font>::is_valid()` gate does (`scene/resources/theme.cpp:549-552`),
 *   so "explicitly nothing" equals "never set" for fonts and font sizes.
 */
function scanTheme<T>(
  properties: Record<string, string>,
  resolveRef: (ref: string) => T | null
): Omit<ScannedTheme<T>, 'resources'> {
  // Prototype-free, since type and name come from a `.tres` key: otherwise
  // `__proto__/fonts/toString = …` skips the `??=` and writes to
  // `Object.prototype`. `in` on the read side (`lookup.ts`) walks the chain too.
  const fonts: Record<string, Record<string, T>> = Object.create(null);
  const fontSizes: Record<string, Record<string, number>> = Object.create(null);
  const styles: Record<string, Record<string, string>> = Object.create(null);
  const icons: Record<string, Record<string, string>> = Object.create(null);
  const colors: Record<string, Record<string, Color>> = Object.create(null);
  const constants: Record<string, Record<string, number>> = Object.create(null);
  const typeVariations: Record<string, string> = Object.create(null);
  const rest: Record<string, string> = Object.create(null);

  let defaultFont: T | null = null;
  let defaultFontSize: number | undefined;

  for (const [key, value] of Object.entries(properties)) {
    if (key === 'default_font') {
      defaultFont = resolveRef(value);
      continue;
    }
    if (key === 'default_font_size') {
      const n = parseOptionalFloat(value);
      if (n !== undefined && n > 0) defaultFontSize = n;
      continue;
    }

    const fontMatch = key.match(FONT_ENTRY);
    if (fontMatch) {
      const [, type, name] = fontMatch;
      const resolved = resolveRef(value);
      if (resolved !== null) (fonts[type!] ??= Object.create(null))[name!] = resolved;
      continue;
    }

    const sizeMatch = key.match(FONT_SIZE_ENTRY);
    if (sizeMatch) {
      const [, type, name] = sizeMatch;
      const n = parseOptionalFloat(value);
      if (n !== undefined && n > 0) (fontSizes[type!] ??= Object.create(null))[name!] = n;
      continue;
    }

    const styleMatch = key.match(STYLE_ENTRY);
    if (styleMatch) {
      const [, type, name] = styleMatch;
      (styles[type!] ??= Object.create(null))[name!] = value;
      continue;
    }

    const iconMatch = key.match(ICON_ENTRY);
    if (iconMatch) {
      const [, type, name] = iconMatch;
      (icons[type!] ??= Object.create(null))[name!] = value;
      continue;
    }

    const colorMatch = key.match(COLOR_ENTRY);
    if (colorMatch) {
      const [, type, name] = colorMatch;
      const c = parseColorOrUndefined(value);
      if (c !== undefined) (colors[type!] ??= Object.create(null))[name!] = c;
      continue;
    }

    const constantMatch = key.match(CONSTANT_ENTRY);
    if (constantMatch) {
      const [, type, name] = constantMatch;
      const n = parseOptionalFloat(value);
      // `int constant_map` (`theme.h`): `_to_int` truncates a fractional literal.
      if (n !== undefined) (constants[type!] ??= Object.create(null))[name!] = Math.trunc(n);
      continue;
    }

    const baseMatch = key.match(BASE_TYPE_ENTRY);
    if (baseMatch) {
      const [, variation] = baseMatch;
      const base = unquoteStringName(value);
      if (base !== '') typeVariations[variation!] = base;
      continue;
    }

    rest[key] = value;
  }

  return { defaultFont, defaultFontSize, fonts, fontSizes, styles, icons, colors, constants, typeVariations, properties: rest };
}

/**
 * One file-backed Theme resource body into `ThemeAddresses`, with no I/O.
 * `selfPath` is what a `SubResource` font ref resolves against
 * (`res://file.tres::SubId`): always the owning `.tres`, never the Theme's address.
 */
export function decodeThemeAddresses(
  selfPath: string,
  properties: Record<string, string>,
  extResources: readonly TscnExternalResource[],
  subResources: readonly TscnInternalResource[]
): ThemeAddresses {
  const extPathById = new Map(extResources.map((r) => [r.id, r.path]));
  const gate = subResourceTypeGate(subResources, FONT_SUB_RESOURCE_TYPES);
  const scanned = scanTheme(properties, (ref) => resolveRefToResourcePath(ref, extPathById, selfPath, gate));
  return { ...scanned, resources: { externalResources: extResources, internalResources: subResources } };
}

/**
 * A scene's inline `[sub_resource type="Theme"]` to a `ThemeResource`,
 * synchronously, since the solve walk cannot `await`. A font ref names a sibling
 * sub-resource, read directly: the font processor's `parseTresFile` throws on a
 * `[gd_scene]` header.
 */
export function resolveInlineThemeResource(
  properties: Record<string, string>,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  fontCache: FontCacheReader,
  pending: Set<string>
): ThemeResource {
  const scanned = scanTheme(properties, (ref) =>
    resolveInlineFontResource(ref, externalResources, internalResources, fontCache, pending)
  );
  return { ...scanned, resources: { externalResources, internalResources } };
}
