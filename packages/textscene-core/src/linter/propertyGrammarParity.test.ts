/**
 * Property-grammar parity guard.
 *
 * For every slice that has both `parser.ts` and `linterParser.ts`, asserts
 * that the set of property names read by the parser (via `properties.X`)
 * matches the set of validator keys registered for that node type.
 *
 * Each side is augmented by the inherited set its ancestor contributes:
 *   - Validator keys: walk NODE_BASE_TYPES and collect each base type's
 *     own registered keys via `validatorRegistry.getOwnKeys()`.
 *   - Parser properties: walk NODE_BASE_TYPES and scrape each base type's
 *     `parser.ts` file for `properties.X` accesses.
 *
 * Legitimate asymmetries are recorded in ASYMMETRY_ALLOWLIST below.  Every
 * entry carries a one-line justification and doubles as the inventory that
 * feeds the descriptor-DSL pilot design.
 *
 * Desync detection:
 *   - A parser-only key not in the allowlist means a property was added to
 *     `parser.ts` but the matching validator was never registered.
 *   - A linter-only key not in the allowlist means a validator key was added
 *     to `linterParser.ts` but the parser never reads it (potential dead
 *     validator if the property is also not inherited).
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import './index.js';

const here = dirname(fileURLToPath(import.meta.url));
const nodesRoot = resolve(here, '../nodes');

// ---------------------------------------------------------------------------
// Base-type to parser directory mapping.
// Used to walk the inherited parser property chain in parallel with the
// NODE_BASE_TYPES validator chain.
// ---------------------------------------------------------------------------

const BASE_TYPE_TO_PARSER_SUBPATH: Readonly<Record<string, string>> = {
  Node3D: 'base/node3d/parser.ts',
  Node2D: 'base/node2d/parser.ts',
  Light3D: '3d/lights/shared/parser.ts',
  Control: '2d/ui/control/parser.ts',
  Node: 'node/parser.ts',
};

// ---------------------------------------------------------------------------
// Allowlist of known, justified asymmetries.
//
// "parserOnly"  — parser reads this property for rendering but no linter
//                 validator is registered (acceptable: the renderer needs it,
//                 the linter has nothing to check).
// "linterOnly"  — linter validates this key but the parser never reads it
//                 (acceptable: valid TSCN property the renderer ignores).
//
// Shared keys that span every Node2D or Node3D leaf are recorded on the base
// type (Node2D / Node3D) and inherited automatically; leaf-specific entries
// only contain keys that are unique to that slice.
// ---------------------------------------------------------------------------

interface AsymmetryEntry {
  parserOnly?: readonly string[];
  linterOnly?: readonly string[];
  reason: string;
}

/**
 * Light3D base validators (registered once under the abstract 'Light3D' key
 * in 3d/lights/shared/linterParser.ts and inherited by every concrete light
 * via the base-walk) that the shared parser helpers never read: bake/cull and
 * fine shadow-tuning properties with no effect on the static preview.
 */
const LIGHT3D_LINTER_ONLY_KEYS = [
  'light_bake_mode', 'light_cull_mask', 'light_indirect_energy',
  'shadow_opacity', 'shadow_reverse_cull_face', 'shadow_transmittance_bias',
] as const;

/**
 * Keys read by the parseAudioBase shared helper (not captured by the per-file
 * scrape of each audio player's parser.ts); each linterParser.ts registers
 * them explicitly.
 */
const AUDIO_BASE_KEYS = [
  'stream', 'volume_db', 'pitch_scale', 'playing', 'autoplay',
  'stream_paused', 'bus', 'max_polyphony',
] as const;

const ASYMMETRY_ALLOWLIST: Readonly<Record<string, AsymmetryEntry>> = {
  // -------------------------------------------------------------------------
  // Base types
  // -------------------------------------------------------------------------

  Node3D: {
    linterOnly: [
      // Godot serialises spatial state as either a single `transform` matrix
      // (what the lenient parser reads) or as discrete components; the linter
      // validates the component form so each property is individually
      // checkable, but the renderer only needs the matrix.
      'position', 'rotation', 'rotation_degrees', 'scale', 'quaternion', 'basis',
      // Global-space equivalents — Godot writes these in some export modes;
      // the renderer ignores them (uses local transform).
      'global_transform', 'global_position', 'global_rotation', 'global_rotation_degrees',
      'global_basis',
      // Scene-tree / editor properties with no render effect.
      'top_level', 'rotation_order', 'visibility_parent',
    ],
    reason: 'Parser uses the transform matrix; linter validates discrete component forms and global equivalents that the renderer ignores.',
  },

  Light3D: {
    linterOnly: LIGHT3D_LINTER_ONLY_KEYS,
    reason: 'Light3D base validators live in 3d/lights/shared/linterParser.ts and reach every concrete light via the base-walk; bake/cull-mask and fine shadow-tuning keys are runtime-only, so the shared parser helpers never read them.',
  },

  Node2D: {
    parserOnly: [
      // CanvasItem draw-order / tint properties parsed by the renderer but
      // not validated by the linter (no format constraints that could fail).
      'visible', 'modulate', 'self_modulate', 'show_behind_parent',
      // y_sort_origin only meaningful for TileMapLayer tiles; no linter
      // validator needed (any number is valid).
      'y_sort_origin',
    ],
    linterOnly: [
      // Global-space equivalents — valid TSCN but the renderer ignores them
      // (uses local transform / draw order).
      'global_position', 'global_rotation', 'global_rotation_degrees',
      'global_scale', 'global_skew', 'global_transform',
    ],
    reason: 'Parser reads CanvasItem tint/draw-order, y_sort_enabled and y_sort_origin fields not covered by linter validators; linter validates global-space properties the renderer ignores.',
  },

  Control: {
    parserOnly: [
      // Control.transform in TSCN is a Transform2D that Godot sometimes
      // emits; the parser reads it for compatibility but there is no
      // linter validator (it conflicts with the anchor/offset layout model).
      'transform',
    ],
    linterOnly: [
      // (`modulate`, `self_modulate`, `rotation`, `scale` and `pivot_offset`
      // used to sit here as "not read by the parser for rendering"; they are
      // all rendered now.)
      // Theme-override wildcard keys — validated by pattern match in the
      // linter; the parser uses a loop over `theme_override_*/*` keys and
      // there is no fixed per-key scraping surface to compare against.
      'theme_override_colors/*', 'theme_override_constants/*',
      'theme_override_font_sizes/*', 'theme_override_styles/*',
      'theme_override_fonts/*',
    ],
    reason: 'Control parser reads transform for compatibility but linter does not validate it; the theme-override keys are wildcard-matched in the linter and loop-scraped in the parser, so they have no per-key surface to compare.',
  },

  // -------------------------------------------------------------------------
  // 2D leaf slices
  // -------------------------------------------------------------------------

  AnimatedSprite2D: {
    linterOnly: [
      // Playback-state properties: valid in TSCN but the renderer reads the
      // initial frame directly; runtime playback is not modelled.
      'autoplay', 'playing', 'frame_progress', 'speed_scale',
    ],
    reason: 'AnimatedSprite2D linter validates runtime playback properties (autoplay, playing, speed_scale, frame_progress) that the static renderer ignores.',
  },

  Camera2D: {
    linterOnly: [
      // Viewport behaviour / editor aids: valid TSCN keys with no effect
      // on the static scene preview.
      // (`limit_left/top/right/bottom` used to sit here; the Cameras panel
      // clamps the framed view to them now.)
      'ignore_rotation', 'process_callback', 'limit_smoothed',
      'position_smoothing_enabled', 'position_smoothing_speed',
      'rotation_smoothing_enabled', 'rotation_smoothing_speed',
      'drag_horizontal_enabled', 'drag_vertical_enabled',
      'drag_horizontal_offset', 'drag_vertical_offset',
      'drag_left_margin', 'drag_right_margin', 'drag_top_margin', 'drag_bottom_margin',
      'editor_draw_limits', 'editor_draw_screen', 'editor_draw_drag_margin',
    ],
    reason: 'Camera2D linter validates follow/drag/smoothing properties that only matter at runtime; the static previewer ignores them.',
  },

  Line2D: {
    parserOnly: [
      // PackedVector2Array body: complex binary-encoded data with no
      // per-key validator available (same convention as Polygon2D.polygon).
      'points',
    ],
    reason: 'Line2D points is a PackedVector2Array (opaque encoded data); no format validator exists for packed arrays.',
  },

  Polygon2D: {
    parserOnly: [
      // PackedVector2Array / Array-of-PackedInt32Array bodies (same pattern as
      // Line2D.points above): opaque encoded data with no per-key grammar.
      'polygon', 'polygons',
    ],
    linterOnly: [
      // Display tweaks with no rendering parity requirement. (`invert_enabled`
      // and `invert_border` used to sit here; both are rendered now.)
      'antialiased', 'texture_offset', 'texture_rotation', 'texture_scale',
    ],
    reason: 'polygon/polygons are encoded packed arrays with no per-key grammar; the remaining texture-transform properties affect visual output but the renderer reads color/offset only.',
  },

  TileMapLayer: {
    parserOnly: [
      // Raw tile cell stream (PackedByteArray): decoded by a dedicated
      // helper; the linter has no format validator for packed cell data.
      'tile_map_data',
    ],
    reason: 'tile_map_data is a PackedByteArray decoded by decodeTileMapData; transform/position are covered by the Node2D base on both parser and validator sides.',
  },

  TileMap: {
    reason: 'No unique asymmetries; transform/position covered by Node2D base on both sides.',
  },

  LightOccluder2D: {
    parserOnly: [
      // light_mask and occluder_light_mask are bitmasks (int32) with no
      // range constraint that the linter can validate — any integer is valid
      // in TSCN, so there is no grammar that can fail.
      'light_mask', 'occluder_light_mask',
    ],
    reason: 'light_mask and occluder_light_mask are arbitrary bitmasks with no valid range; the linter has no grammar to validate.',
  },

  // -------------------------------------------------------------------------
  // 3D leaf slices
  // -------------------------------------------------------------------------

  GridMap: {
    parserOnly: [
      // Godot GridMap cell dictionary (`{ "cells": PackedInt32Array(...) }`):
      // decoded by extractCells; no linter format validator for packed cell
      // data exists.
      'data',
    ],
    reason: 'data is a packed cell dictionary decoded by a bespoke helper; transform is covered by Node3D base on both parser and validator sides.',
  },

  Label3D: {
    parserOnly: [
      // double_sided toggle: read for rendering but not validated by the
      // linter (boolean with Godot-default=true, no range constraint).
      'double_sided',
    ],
    reason: 'Label3D.double_sided is a boolean read by the parser; the linter has no constraint to enforce.',
  },

  Sprite3D: {
    parserOnly: [
      // Properties read by the parser for rendering but not validated by the
      // linter (booleans with Godot defaults, no range constraints).
      'centered', 'flip_h', 'flip_v', 'region_enabled', 'double_sided', 'transparent',
    ],
    reason: 'Sprite3D boolean toggles (centered, flip_h/v, region_enabled, double_sided, transparent) are read for rendering but the linter enforces no constraint on boolean values that are always valid.',
  },

  CSGBox3D: {
    linterOnly: [
      // CSG parsers call finishCsgParse which reads material/operation from
      // shared helper; linter registers them explicitly per slice but they
      // are not visible to the per-file parser scrape.
      'material', 'operation',
    ],
    reason: 'CSG parsers read material/operation via finishCsgParse shared helper (not scrape-visible in parser.ts); linter registers them explicitly.',
  },

  CSGCylinder3D: {
    linterOnly: ['material', 'operation'],
    reason: 'Same as CSGBox3D: finishCsgParse reads material/operation via shared helper not visible to the scrape.',
  },

  CSGSphere3D: {
    linterOnly: ['material', 'operation'],
    reason: 'Same as CSGBox3D: finishCsgParse reads material/operation via shared helper not visible to the scrape.',
  },

  Decal: {
    reason: 'No unique asymmetries; transform is covered by Node3D base on both parser and validator sides.',
  },

  MeshInstance3D: {
    linterOnly: [
      // Wildcard slot validator (surface_material_override/N) registered as
      // a pattern; parser reads via a loop over Object.keys and is not
      // captured by the properties.X scrape pattern.
      'surface_material_override/*',
    ],
    reason: 'MeshInstance3D linter uses a wildcard pattern for surface_material_override/N; the parser reads those via an Object.keys loop not captured by the scrape.',
  },

  NavigationAgent3D: {
    parserOnly: [
      // NavigationAgent3D's parser inherits `transform` via parseNode
      // (node/parser.ts), but NODE_BASE_TYPES maps NavigationAgent3D to Node,
      // which registers no spatial validators — so transform is parser-only.
      'transform',
    ],
    reason: 'NavigationAgent3D parser inherits transform via parseNode (node/parser.ts); NODE_BASE_TYPES maps NavigationAgent3D to Node with no spatial validators, so transform is parser-only.',
  },

  // -------------------------------------------------------------------------
  // Animation
  // -------------------------------------------------------------------------

  AnimationPlayer: {
    parserOnly: [
      // Complex multi-form dictionary: parsed by extractLibraries via
      // Object.keys loop and dict matching; no linter validator exists.
      'libraries',
      // AnimationPlayer parser calls parseNode3D (reads transform/visible)
      // but NODE_BASE_TYPES maps it to Node (no Node3D validators).
      'transform',
    ],
    reason: 'AnimationPlayer.libraries uses a bespoke dictionary decoder; parser calls parseNode3D for transform but NODE_BASE_TYPES declares it a plain Node with no spatial validators.',
  },

  AnimationTree: {
    parserOnly: [
      // AnimationTree parser calls parseNode3D but NODE_BASE_TYPES maps it
      // to Node (same pattern as AnimationPlayer).
      'transform',
    ],
    reason: 'AnimationTree parser calls parseNode3D but NODE_BASE_TYPES declares it a plain Node; transform is parser-only.',
  },

  // -------------------------------------------------------------------------
  // Audio (parseAudioBase shared-helper pattern)
  // -------------------------------------------------------------------------

  AudioStreamPlayer: {
    parserOnly: [
      // AudioStreamPlayer parser calls parseNode (reads transform) but
      // NODE_BASE_TYPES maps it to Node with no spatial validators.
      'transform',
    ],
    linterOnly: AUDIO_BASE_KEYS,
    reason: 'AudioStreamPlayer reads audio properties via parseAudioBase shared helper (not visible to per-file scrape); linter registers them explicitly. parser/parser.ts delegates entirely to helpers.',
  },

  AudioStreamPlayer2D: {
    linterOnly: AUDIO_BASE_KEYS,
    reason: 'AudioStreamPlayer2D reads audio base properties via parseAudioBase shared helper not captured by per-file scrape; linter registers them explicitly.',
  },

  AudioStreamPlayer3D: {
    linterOnly: AUDIO_BASE_KEYS,
    reason: 'AudioStreamPlayer3D reads audio base properties via parseAudioBase shared helper not captured by per-file scrape; linter registers them explicitly.',
  },

  // -------------------------------------------------------------------------
  // Lights (Light3D base level: shared validators + parseBaseLight* helpers,
  // both walked via the Light3D entries in NODE_BASE_TYPES and
  // BASE_TYPE_TO_PARSER_SUBPATH; base-level asymmetries live on Light3D above)
  // -------------------------------------------------------------------------

  DirectionalLight3D: {
    linterOnly: [
      // DirectionalLight3D linter registers additional shadow/sky properties
      // beyond what the parser reads for the preview.
      'directional_shadow_blend_splits', 'directional_shadow_fade_start',
      'directional_shadow_pancake_size',
      'directional_shadow_split_1', 'directional_shadow_split_2', 'directional_shadow_split_3',
      'sky_mode',
    ],
    reason: 'DirectionalLight3D linter validates additional shadow-cascade/sky tuning properties the static renderer ignores; the Light3D base keys are covered by the Light3D entry on both sides.',
  },

  OmniLight3D: {
    reason: 'No unique asymmetries; omni_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  SpotLight3D: {
    reason: 'No unique asymmetries; spot_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  AreaLight3D: {
    reason: 'No unique asymmetries; area_* keys are symmetric and Light3D base keys are covered by the Light3D entry on both sides.',
  },

  // -------------------------------------------------------------------------
  // Physics (linter-only physics properties)
  // -------------------------------------------------------------------------

  Area2D: {
    linterOnly: [
      // Physics simulation properties: valid TSCN but the static renderer
      // reads only collision_layer/collision_mask for display.
      'space_override', 'gravity_space_override', 'gravity_point',
      'gravity_point_center', 'gravity_point_unit_distance',
      'gravity_direction', 'gravity', 'linear_damp_space_override',
      'linear_damp', 'angular_damp_space_override', 'angular_damp',
      'priority', 'audio_bus_override', 'audio_bus_name', 'disable_mode',
    ],
    reason: 'Area2D physics simulation properties (gravity, damping, space-override) are linter-validated but ignored by the static previewer which only needs collision_layer/mask.',
  },

  CollisionShape2D: {
    linterOnly: [
      // Physics-behaviour properties with no visual counterpart. (`debug_color`
      // used to sit here; the gizmo draws in it now.)
      'one_way_collision', 'one_way_collision_margin',
    ],
    reason: 'CollisionShape2D one_way settings affect runtime physics only; the renderer reads shape/disabled/debug_color for visual display.',
  },

  // -------------------------------------------------------------------------
  // Nodes that parser uses parseNode3D but NODE_BASE_TYPES maps to Node
  // -------------------------------------------------------------------------

  WorldEnvironment: {
    parserOnly: [
      // WorldEnvironment parser calls parseNode3D but NODE_BASE_TYPES
      // declares it a plain Node; transform/visible are parsed but no
      // Node3D validators are inherited.
      'transform',
    ],
    reason: 'WorldEnvironment parser calls parseNode3D but NODE_BASE_TYPES declares it a plain Node; transform is parser-only with no counterpart validator.',
  },

  Timer: {
    parserOnly: [
      // Timer parser calls parseNode which reads transform; NODE_BASE_TYPES
      // maps Timer to Node with no spatial validators.
      'transform',
    ],
    reason: 'Timer parser inherits transform via parseNode (node/parser.ts); NODE_BASE_TYPES maps Timer to Node with no spatial validators.',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Walk dir recursively; collect paths where both parser.ts and linterParser.ts exist. */
function findSliceDirs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const names = new Set(entries.map((e) => e.name));
  const result = names.has('parser.ts') && names.has('linterParser.ts') ? [dir] : [];
  for (const e of entries) {
    if (e.isDirectory()) result.push(...findSliceDirs(join(dir, e.name)));
  }
  return result;
}

/**
 * Scrape `properties.X` and `properties['X']` accesses from a parser source.
 * Returns only identifier-shaped keys (alphanumeric + underscore).
 */
function scrapeParserProps(src: string): Set<string> {
  const props = new Set<string>();
  // properties.identifier
  const dotRe = /\bproperties\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = dotRe.exec(src)) !== null) props.add(m[1]!);
  // properties['key'] or properties["key"]
  const bracketRe = /\bproperties\[['"]([^'"]+)['"]\]/g;
  while ((m = bracketRe.exec(src)) !== null) props.add(m[1]!);
  return props;
}

/** Ancestor chain of a node type (excluding the type itself), cycle-safe. */
function baseChain(nodeType: string): string[] {
  const chain: string[] = [];
  const visited = new Set<string>([nodeType]);
  let current: string | undefined = NODE_BASE_TYPES[nodeType];
  while (current && !visited.has(current)) {
    visited.add(current);
    chain.push(current);
    current = NODE_BASE_TYPES[current];
  }
  return chain;
}

/**
 * All `properties.X` accesses inherited from the base parser files of a node
 * type's NODE_BASE_TYPES chain. Throws if a mapped base parser file has moved,
 * so a broken mapping fails loudly instead of surfacing as bogus asymmetries.
 */
function getInheritedParserProps(nodeType: string): Set<string> {
  const result = new Set<string>();
  for (const base of baseChain(nodeType)) {
    const subpath = BASE_TYPE_TO_PARSER_SUBPATH[base];
    if (!subpath) continue;
    const parserPath = join(nodesRoot, subpath);
    if (!existsSync(parserPath)) {
      throw new Error(
        `BASE_TYPE_TO_PARSER_SUBPATH['${base}'] points at a missing file: ${subpath}`
      );
    }
    for (const p of scrapeParserProps(readFileSync(parserPath, 'utf8'))) result.add(p);
  }
  return result;
}

/** Validator keys registered directly for a node type or any of its ancestors. */
function getFullValidatorKeys(nodeType: string): Set<string> {
  const result = new Set(validatorRegistry.getOwnKeys(nodeType));
  for (const base of baseChain(nodeType)) {
    for (const k of validatorRegistry.getOwnKeys(base)) result.add(k);
  }
  return result;
}

/**
 * Extract the node type name from a linterParser.ts source via
 * `registerAll('TypeName', ...)`.  Returns null for shared helpers that
 * export constants but do not call registerAll.
 */
function extractNodeType(src: string): string | null {
  const m = /registerAll\s*\(\s*'([^']+)'/.exec(src);
  return m ? m[1]! : null;
}

// ---------------------------------------------------------------------------
// Slice inventory: one walk + one scrape per slice, shared by all tests.
// ---------------------------------------------------------------------------

interface SliceInfo {
  /** Slice directory relative to src/nodes. */
  slice: string;
  nodeType: string;
  /** Own scraped props + inherited base parser props. */
  parserProps: Set<string>;
  /** Own registered keys + inherited base validator keys. */
  validatorKeys: Set<string>;
}

let cachedSlices: SliceInfo[] | null = null;

function collectSlices(): SliceInfo[] {
  if (cachedSlices) return cachedSlices;
  cachedSlices = [];
  for (const dir of findSliceDirs(nodesRoot).sort()) {
    const linterSrc = readFileSync(join(dir, 'linterParser.ts'), 'utf8');
    const nodeType = extractNodeType(linterSrc);
    if (!nodeType) continue; // shared-helper file — no registerAll

    const parserSrc = readFileSync(join(dir, 'parser.ts'), 'utf8');
    cachedSlices.push({
      slice: dir.slice(nodesRoot.length + 1),
      nodeType,
      parserProps: new Set([
        ...scrapeParserProps(parserSrc),
        ...getInheritedParserProps(nodeType),
      ]),
      validatorKeys: getFullValidatorKeys(nodeType),
    });
  }
  return cachedSlices;
}

// ---------------------------------------------------------------------------
// Core guard logic
// ---------------------------------------------------------------------------

interface ParityViolation {
  slice: string;
  nodeType: string;
  parserOnlyNotAllowlisted: string[];
  linterOnlyNotAllowlisted: string[];
}

function checkParity(): ParityViolation[] {
  const violations: ParityViolation[] = [];

  for (const { slice, nodeType, parserProps, validatorKeys } of collectSlices()) {
    // Collect allowlist entries from this type AND all ancestor types so a
    // base-type entry (e.g. Node3D.linterOnly) applies to every leaf slice.
    const allowedParserOnly = new Set<string>();
    const allowedLinterOnly = new Set<string>();
    for (const t of [nodeType, ...baseChain(nodeType)]) {
      const e = ASYMMETRY_ALLOWLIST[t];
      if (!e) continue;
      for (const k of e.parserOnly ?? []) allowedParserOnly.add(k);
      for (const k of e.linterOnly ?? []) allowedLinterOnly.add(k);
    }

    const parserOnlyNotAllowlisted = [...parserProps]
      .filter((k) => !validatorKeys.has(k) && !allowedParserOnly.has(k))
      .sort();
    const linterOnlyNotAllowlisted = [...validatorKeys]
      .filter((k) => !parserProps.has(k) && !allowedLinterOnly.has(k))
      .sort();

    if (parserOnlyNotAllowlisted.length > 0 || linterOnlyNotAllowlisted.length > 0) {
      violations.push({ slice, nodeType, parserOnlyNotAllowlisted, linterOnlyNotAllowlisted });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('property-grammar parity guard', () => {
  it('finds slice pairs to check (sanity: walk is not empty)', () => {
    expect(collectSlices().length).toBeGreaterThan(0);
  });

  it('every slice pair has symmetric property coverage (or an allowlisted asymmetry)', () => {
    const violations = checkParity();

    const lines: string[] = ['Unapproved parser/validator asymmetries:'];
    for (const v of violations) {
      lines.push(`\n  ${v.slice} [${v.nodeType}]:`);
      if (v.parserOnlyNotAllowlisted.length > 0)
        lines.push(`    parser-only (no validator): ${v.parserOnlyNotAllowlisted.join(', ')}`);
      if (v.linterOnlyNotAllowlisted.length > 0)
        lines.push(`    linter-only (no parser read): ${v.linterOnlyNotAllowlisted.join(', ')}`);
      lines.push(`    → add to ASYMMETRY_ALLOWLIST['${v.nodeType}'] with a reason, or fix the desync.`);
    }
    expect(violations, lines.join('\n')).toEqual([]);
  });

  it('allowlist entries stay honest: every listed key is genuinely asymmetric', () => {
    const slicesByType = new Map(collectSlices().map((s) => [s.nodeType, s]));
    const staleSections: string[] = [];

    for (const [nodeType, entry] of Object.entries(ASYMMETRY_ALLOWLIST)) {
      const slice = slicesByType.get(nodeType);
      if (!slice) {
        // Node type no longer has a slice pair — allowlist entry is stale.
        staleSections.push(`${nodeType}: no parser.ts+linterParser.ts pair found`);
        continue;
      }

      // parserOnly keys should NOT have a validator; linterOnly keys should
      // NOT be read by the parser — otherwise the asymmetry has been fixed.
      for (const key of entry.parserOnly ?? []) {
        if (slice.validatorKeys.has(key)) {
          staleSections.push(`${nodeType}.parserOnly['${key}']: now has a validator — remove from allowlist`);
        }
      }
      for (const key of entry.linterOnly ?? []) {
        if (slice.parserProps.has(key)) {
          staleSections.push(`${nodeType}.linterOnly['${key}']: now read by the parser — remove from allowlist`);
        }
      }
    }

    expect(staleSections, `Stale allowlist entries found:\n  ${staleSections.join('\n  ')}`).toEqual([]);
  });
});
