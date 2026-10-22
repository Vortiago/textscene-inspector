/**
 * Parses Godot's `project.godot`, the configuration at a project's `res://` root, into settings
 * keyed by full name. A foreign-format parser outside the resource-slice registry (ADR-0031): no
 * scene names it, so it claims no type name and no bus slot.
 */
import { STRING_ARRAY_FORMS, packedArrayBody } from '../godot/variant/variantParser.js';
import {
  STRING_LITERAL_RE,
  STRING_LITERAL_SOURCE,
  dropTrailingComma,
  splitTopLevel,
} from '../godot/string/string.js';
import { boolSlotValue } from '../godot/variant/variantBool.js';
import { dataDirectoryPath, extensionListPath } from '../godot/project/project.js';
import { isLocaleRightToLeft } from '../godot/text/textServer.js';
import type { LayoutDirectionEnv } from '../godot/scene/control.js';
import { DEFAULT_CLEAR_COLOR } from '../godot/rendering/rendering.js';
import { unquoteLiteral } from './utils.js';
import { colorOr } from '../utils/colorParser.js';
import { parseOptionalFloat, parseOptionalInt } from './valueParsers.js';
import { DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE, primitiveMeshTexelSize } from '../godot/scene/primitiveMesh.js';
import {
  VOLUMETRIC_FOG_DEFAULTS,
  type VolumetricFogProjectSettings,
} from '../godot/rendering/environment/volumetricFog.js';
import { MSAA_DISABLED } from '../godot/rendering/msaa.js';
import type { Rgba } from '../godot/math/math.js';
import { GlowUpscaleMode } from '../godot/rendering/environment/glow.js';
import { LIGHTMAP_BICUBIC_FILTER_DEFAULT } from '../godot/scene/lightmapGi.js';

/**
 * A `key=value` line as `parse_tag_assign_eof` reads it (`variant_parser.cpp:1932-1950`): blanks may precede the `=`,
 * and a key is quoted where the writer quotes it, as for a Unicode autoload name (`property_name_encode`,
 * `ustring.cpp:5056-5067`). A feature-tagged override like `renderer/rendering_method.mobile` is a real key.
 */
const KEY_VALUE = new RegExp(String.raw`^(${STRING_LITERAL_SOURCE}|[^\s="]+)\s*=(.*)$`);
/** A `[section]` heading, and any `;` comment after it. Godot's section names are bare identifiers. */
const SECTION = /^\[([A-Za-z_][A-Za-z0-9_]*)\]\s*(?:;.*)?$/;

/**
 * `project.godot` settings, keyed by full setting name: a string literal's decoded text, as
 * `VariantParser` reads the file back (`project_settings.cpp:964`), and any other value as
 * written. Typed readers exist only for settings this previewer honours, so the store does not
 * become a settings grab-bag.
 */
export type ProjectSettings = Readonly<Record<string, string>>;

/**
 * A `project.godot`'s settings, or null when the text is not one. Null, not a throw: absence and
 * malformedness are both ordinary, and the caller uses Godot's defaults either way. Not
 * `TscnParserCore`: bare `[section]` headings and plain `key=value` lines, the INI shape of
 * `importParser.ts`, leave nothing to diagnose.
 */
export function parseProjectSettings(content: string): ProjectSettings | null {
  const settings: Record<string, string> = {};
  let section: string | null = null;
  let sawSetting = false;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith(';')) continue;

    const heading = SECTION.exec(line);
    if (heading) {
      section = heading[1]!;
      continue;
    }

    // A multi-line quoted value, such as `config/description`, keeps its first line: the
    // continuation has no `=`. No setting this previewer reads is multi-line.
    const pair = KEY_VALUE.exec(line);
    if (!pair) continue;
    const [, rawKey, rawValue] = pair;
    const key = unquoteLiteral(rawKey!);
    // Godot splits a name across heading and key: `theme/default_theme_scale` under
    // `[gui]` is `gui/theme/default_theme_scale`, as `ProjectSettings.get_setting()`
    // takes it. `config_version` above the first heading keeps its bare name.
    settings[section ? `${section}/${key}` : key] = unquoteLiteral(rawValue!.trim());
    sawSetting = true;
  }

  return sawSetting ? settings : null;
}

/** Godot's default when the project does not set the scale. */
export const DEFAULT_THEME_SCALE = 1.0;

/**
 * `gui/theme/default_theme_scale`, the multiplier on every default-theme metric
 * (`ThemeDB::initialize_theme()` in `scene/theme/theme_db.cpp`, default 1.0). Clamped
 * here to 0.5-8 as `make_default_theme` does (`scene/theme/default_theme.cpp:1369`).
 * Each metric rounds after multiplying ({@link scaledGodotTheme}).
 */
export function projectThemeScale(settings: ProjectSettings | null): number {
  const raw = settings?.['gui/theme/default_theme_scale'];
  // An empty value says nothing, not zero: `Number('')` is 0, which would clamp to 0.5
  // and shrink the UI.
  if (raw === undefined || raw.trim() === '') return DEFAULT_THEME_SCALE;

  const scale = Number(raw);
  // An unparseable or non-finite value falls back, not a collapsed UI.
  if (!Number.isFinite(scale)) return DEFAULT_THEME_SCALE;
  return Math.min(Math.max(scale, 0.5), 8);
}

/**
 * Godot's defaults for `display/window/size/viewport_width` and `_height`
 * (`main/main.cpp`'s `GLOBAL_DEF_BASIC` pair), which frame a scene with no
 * `project.godot`, as Godot does.
 */
export const DEFAULT_VIEWPORT_WIDTH = 1152;
export const DEFAULT_VIEWPORT_HEIGHT = 648;

/** The project viewport rectangle, in pixels. */
export interface ProjectViewportSize {
  width: number;
  height: number;
}

/**
 * `display/window/size/viewport_*`: the rect a 2D scene is composed against and a root
 * Control anchors to. Per axis, as Godot falls back per setting. Both settings are INT
 * (`project_settings.cpp:1711-1712`), so a fraction truncates. An unreadable or
 * non-positive value takes the default: a zero-width viewport cannot be laid out.
 */
export function projectViewportSize(settings: ProjectSettings | null): ProjectViewportSize {
  const axis = (key: string, fallback: number): number => {
    const value = parseOptionalInt(settings?.[key]);
    return value === undefined || value <= 0 ? fallback : value;
  };
  return {
    width: axis('display/window/size/viewport_width', DEFAULT_VIEWPORT_WIDTH),
    height: axis('display/window/size/viewport_height', DEFAULT_VIEWPORT_HEIGHT),
  };
}

/**
 * `rendering/environment/defaults/default_clear_color`, sRGB, which every opaque viewport clears to
 * (`renderer_viewport.cpp:371,751`), or Godot's default for an absent or malformed value.
 */
export function projectClearColor(settings: ProjectSettings | null): Rgba {
  return colorOr(settings?.['rendering/environment/defaults/default_clear_color'], DEFAULT_CLEAR_COLOR);
}

/** `rendering/lightmapping/primitive_meshes/texel_size`, the world size of a texel in a PrimitiveMesh's UV2. */
export function projectPrimitiveMeshTexelSize(settings: ProjectSettings | null): number {
  const setting = parseOptionalFloat(settings?.['rendering/lightmapping/primitive_meshes/texel_size']);
  return primitiveMeshTexelSize(setting ?? DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE);
}

/**
 * `rendering/lightmapping/lightmap_gi/use_bicubic_filter`, which every lightmap read takes
 * (`renderer_scene_render_rd.cpp:1732`), or Godot's default for an absent or malformed value.
 */
export function projectUsesLightmapBicubicFilter(settings: ProjectSettings | null): boolean {
  return (
    boolSlotValue(settings?.['rendering/lightmapping/lightmap_gi/use_bicubic_filter']) ??
    LIGHTMAP_BICUBIC_FILTER_DEFAULT
  );
}

/**
 * `rendering/environment/glow/upscale_mode`, which every glow read takes
 * (`renderer_scene_render_rd.cpp:1717`): bicubic for any mode above Linear, and for an absent or
 * malformed value, as Godot's default is.
 */
export function projectGlowUsesBicubicUpscale(settings: ProjectSettings | null): boolean {
  const mode = parseOptionalInt(settings?.['rendering/environment/glow/upscale_mode']);
  return (mode ?? GlowUpscaleMode.BICUBIC) > GlowUpscaleMode.LINEAR;
}

/**
 * The `rendering/environment/volumetric_fog/*` settings and `fog/use_legacy_blending`, which Godot
 * reads once for every Environment (`renderer_scene_render_rd.cpp:1726-1728`). A volume side that
 * is not a positive integer keeps its default, since no volume has an empty side.
 */
export function projectVolumetricFogSettings(settings: ProjectSettings | null): VolumetricFogProjectSettings {
  const side = (key: string, fallback: number): number => {
    const value = parseOptionalInt(settings?.[key]);
    return value !== undefined && value > 0 ? value : fallback;
  };
  const flag = (key: string, fallback: boolean): boolean => boolSlotValue(settings?.[key]) ?? fallback;
  return {
    volumeSize: side('rendering/environment/volumetric_fog/volume_size', VOLUMETRIC_FOG_DEFAULTS.volumeSize),
    volumeDepth: side(
      'rendering/environment/volumetric_fog/volume_depth',
      VOLUMETRIC_FOG_DEFAULTS.volumeDepth
    ),
    useFilter: flag('rendering/environment/volumetric_fog/use_filter', VOLUMETRIC_FOG_DEFAULTS.useFilter),
    useLegacyBlending: flag(
      'rendering/environment/fog/use_legacy_blending',
      VOLUMETRIC_FOG_DEFAULTS.useLegacyBlending
    ),
  };
}

/** The `Viewport.MSAA` modes of a viewport's 2D and 3D buffers. */
export interface MsaaModes {
  msaa2D: number;
  msaa3D: number;
}

/**
 * `rendering/anti_aliasing/quality/msaa_2d` and `msaa_3d`, which the root viewport takes
 * (`scene/main/scene_tree.cpp:2079-2083`) and the editor's 3D view too
 * (`node_3d_editor_plugin.cpp:3166-3167`). Both default to Disabled.
 */
export function projectMsaaModes(settings: ProjectSettings | null): MsaaModes {
  const mode = (key: string): number => parseOptionalInt(settings?.[key]) ?? MSAA_DISABLED;
  return {
    msaa2D: mode('rendering/anti_aliasing/quality/msaa_2d'),
    msaa3D: mode('rendering/anti_aliasing/quality/msaa_3d'),
  };
}

/**
 * `gui/theme/default_font_generate_mipmaps`, which the default font takes (`theme_db.cpp:64`). Off
 * by default (`text_server.cpp:2387`), so its glyph pages carry no mip chain.
 */
export function projectDefaultFontGeneratesMipmaps(settings: ProjectSettings | null): boolean {
  return boolSlotValue(settings?.['gui/theme/default_font_generate_mipmaps']) ?? false;
}

/** Godot's default `rendering/textures/default_filters/anisotropic_filtering_level`, 4x (`rendering_server.cpp:3750`). */
export const DEFAULT_ANISOTROPIC_FILTERING_LEVEL = 2;

/** `RS::VIEWPORT_ANISOTROPY_16X`, the last level `Viewport.AnisotropicFiltering` names. */
const MAX_ANISOTROPIC_FILTERING_LEVEL = 4;

/**
 * An authored `anisotropic_filtering_level` that names a `Viewport.AnisotropicFiltering` value, or
 * undefined. Godot shifts `1 << level` unchecked (`material_storage.cpp:2461`), so a level outside
 * the enum has no defined meaning to render.
 */
export function parseAnisotropicFilteringLevel(raw: string | undefined): number | undefined {
  const level = parseOptionalInt(raw);
  return level !== undefined && level >= 0 && level <= MAX_ANISOTROPIC_FILTERING_LEVEL ? level : undefined;
}

/**
 * `rendering/textures/default_filters/anisotropic_filtering_level`, which every viewport takes at
 * construction (`viewport.cpp:5384`). An anisotropic sampler reads `1 << level` taps at most.
 */
export function projectAnisotropicFilteringLevel(settings: ProjectSettings | null): number {
  return (
    parseAnisotropicFilteringLevel(
      settings?.['rendering/textures/default_filters/anisotropic_filtering_level']
    ) ?? DEFAULT_ANISOTROPIC_FILTERING_LEVEL
  );
}

/** Godot's default `rendering/textures/default_filters/texture_mipmap_bias` (`rendering_server.cpp:3803`). */
const DEFAULT_TEXTURE_MIPMAP_BIAS = 0;

/**
 * `rendering/textures/default_filters/texture_mipmap_bias`, which every viewport takes at
 * construction (`viewport.cpp:5383`). The setter does not clamp to the `-2..2` hint
 * (`viewport.cpp:4904-4911`), so a larger value passes through.
 */
export function projectTextureMipmapBias(settings: ProjectSettings | null): number {
  return (
    parseOptionalFloat(settings?.['rendering/textures/default_filters/texture_mipmap_bias']) ??
    DEFAULT_TEXTURE_MIPMAP_BIAS
  );
}

/**
 * `rendering/viewport/transparent_background`, which the root viewport takes
 * (`scene/main/scene_tree.cpp:2085-2086`). A transparent root clears to `Color(0, 0, 0, 0)`, not
 * the clear colour (`renderer_viewport.cpp:371`).
 */
export function projectTransparentBackground(settings: ProjectSettings | null): boolean {
  return boolSlotValue(settings?.['rendering/viewport/transparent_background']) === true;
}

/**
 * The `internationalization/*` settings `Control::is_layout_rtl()` reads, as the four
 * booleans its branches produce ({@link LayoutDirectionEnv}). Two inputs are plain
 * settings (`core/config/project_settings.cpp:1797-1798`), and the RTL locale table is
 * a fixed seven-code list (`modules/text_server_adv/text_server_adv.cpp:534-541`).
 */
export function projectLayoutDirectionEnv(settings: ProjectSettings | null): LayoutDirectionEnv {
  // `GLOBAL_GET_CACHED(bool, …)` booleanizes whatever the ConfigFile holds, so
  // `1` reads as true exactly like `true` does.
  const forceRtl =
    boolSlotValue(settings?.['internationalization/rendering/force_right_to_left_layout_direction']) === true;
  // The locale comes from `internationalization/locale/test` when set, else the OS
  // (`core/string/translation_server.cpp:592-599`). The OS locale is in no file, so
  // those arms stay left-to-right.
  const testLocale = settings?.['internationalization/locale/test']?.trim() ?? '';
  const applicationLocaleRtl = testLocale !== '' && isLocaleRightToLeft(testLocale);
  // The host's locale, which no scene file states.
  const systemLocaleRtl = false;

  const rootDirection = parseOptionalInt(
    settings?.['internationalization/rendering/root_node_layout_direction']
  );
  const rootRtl =
    rootDirection === 1
      ? false
      : rootDirection === 2
        ? true
        : rootDirection === 3
          ? systemLocaleRtl
          : applicationLocaleRtl;

  return { forceRtl, rootRtl, applicationLocaleRtl, systemLocaleRtl };
}

/** The prefix of an `[autoload]` entry's full setting name. */
const AUTOLOAD_PREFIX = 'autoload/';

/**
 * The name of each `[autoload]` entry. The editor builds one node per entry with a name, and adds each whose script is
 * a tool script to its own tree (`editor/settings/editor_autoload_settings.cpp:859-869`, `:428-455`). Whether a
 * script is a tool script is in the script, so a caller that reads only this file counts every entry.
 */
export function declaredAutoloads(settings: ProjectSettings | null): string[] {
  return Object.keys(settings ?? {})
    .filter((key) => key.startsWith(AUTOLOAD_PREFIX))
    .map((key) => key.slice(AUTOLOAD_PREFIX.length))
    .filter((name) => name !== '');
}

/**
 * Each entry of `editor_plugins/enabled`, the `plugin.cfg` paths the editor enables at start (`init_plugins`,
 * `editor/editor_node.cpp:1166-1173`), as written. The conversion to `Vector<String>` stringifies each element
 * (`core/variant/variant.cpp:2082-2091`), so an element that is no string literal counts too. Empty for no array.
 */
export function enabledEditorPlugins(settings: ProjectSettings | null): string[] {
  const raw = settings?.['editor_plugins/enabled'];
  const body = raw === undefined ? undefined : packedArrayBody(STRING_ARRAY_FORMS, raw)?.body;
  if (body === undefined) return [];
  return dropTrailingComma(splitTopLevel(body)).map((entry) =>
    STRING_LITERAL_RE.test(entry) ? entry.slice(1, -1) : entry
  );
}

/**
 * Whether the project keeps its data in the hidden directory. A value a BOOL slot cannot read
 * keeps the default, true.
 */
function usesHiddenDataDirectory(settings: ProjectSettings | null): boolean {
  return boolSlotValue(settings?.['application/config/use_hidden_project_data_directory']) !== false;
}

/** The `res://` path of the data directory the project names. */
export function projectDataDirectoryPath(settings: ProjectSettings | null): string {
  return dataDirectoryPath(usesHiddenDataDirectory(settings));
}

/** The `res://` path of the project's GDExtension list, in the data directory the project names. */
export function projectExtensionListPath(settings: ProjectSettings | null): string {
  return extensionListPath(usesHiddenDataDirectory(settings));
}
