/**
 * Property names Godot still accepts under their pre-4.0 spelling.
 *
 * A `#ifndef DISABLE_DEPRECATED` `_set` override forwards the old name to the
 * current setter and returns `true`, so the file loads and the property takes
 * effect — `AnimatedSprite2D::_set` (`animated_sprite_2d.cpp:616-618`) hands
 * `frames` straight to `set_sprite_frames`. To every reader in this codebase
 * the old spelling is simply the same field under another name.
 *
 * NO VALUE TRANSFORMS. Many `_set` overrides also TRANSFORM the value —
 * `Decal`/`RectangleShape2D`/`BoxShape3D`/`VoxelGI` and six
 * `GPUParticlesCollision*` types all map `extents` to `set_size(p_value * 2)`,
 * and `StandardMaterial3D` maps a Godot-3 boolean onto an enum setter. Renaming
 * the key would make the linter validate the right slot while the RENDERER read
 * a value twice the size it should be, so those need a transform, not a table
 * row, and are deliberately absent.
 *
 * An arm may still GATE on the value without transforming it, and two here do:
 * `RichTextLabel::bbcode_text` forwards only a non-empty string and
 * `PointLight2D::mode` only a number. `_set` returns false for the rest, so
 * `_setv` finds nothing under the deprecated name and the write is dropped —
 * renaming it unconditionally applied a value Godot discards, and an empty
 * `bbcode_text` wiped the `text` beside it. That is why the lookup takes the
 * value.
 *
 * The first version of this table was built by grepping for
 * `p_name == SNAME("...")` and found four entries. Most overrides compare
 * against a BARE string literal, so the grep missed `navpoly`, `navmesh`,
 * `start_location`, `target_location` and the rest — and the very false
 * positive this table exists to remove was still shipping on NavigationRegion2D.
 * The list below comes from walking every `::_set` body in `scene/` for either
 * spelling and reading which setter each one calls.
 *
 * SCOPE, stated because it is not obvious: `_setv` (`object.h:429-437`) calls
 * `m_inherits::_setv` FIRST, so an alias declared on a base class applies to
 * every descendant. This table matches on the node's OWN type only. That is
 * sufficient for every entry here — each is declared on a class whose
 * descendants do not inherit the property — but a base-declared pure rename
 * would need a chain walk, and `src/godot/` imports nothing, so the chain is
 * not available at this seam.
 *
 * Applied to the PROPERTY BAG only, never to a validator lookup. Resolving it
 * in `findValidator` made every diagnostic name the canonical key — `align = 5`
 * reported "Property 'horizontal_alignment' must be 0-3", a name that appears
 * nowhere in the user's file and cannot be grepped for. Format coverage for a
 * deprecated key is therefore the slice's own: each type below registers a
 * validator under the old spelling beside the canonical one, so the bound is
 * the same and the message names the key the scene carries.
 * `nodes/2d/bone2d/linterParser.ts:64-70` is the pattern.
 *
 * The parity guard sees such a key as validated-but-unread, since the bag it
 * would appear in has already been rewritten. `aliasedRead` in
 * `linter/propertyGrammarParityAllowlist/types.ts` is the category for that,
 * and it checks {@link isDeprecatedPropertyName} rather than taking the
 * claim on trust.
 *
 * A slice that ALREADY handles its own alias is not listed here, because two
 * mechanisms for one alias is worse than either. `AnimationPlayer` reads
 * `active ?? playback_active` in its parser and registers validators under the
 * deprecated names, so it keeps its own precedence and its own messages;
 * canonicalising the key underneath it changed which of two conflicting values
 * won.
 *
 * One table, because the alias is not a linter concern: the previewer draws
 * `frames = SubResource("…")` only if its parser resolves the name, and the
 * linter reported "Godot clears 'animation'" on 25 scenes across two shipped
 * projects precisely because its rule read the canonical key alone.
 */

import { literalText } from './string.js';
import { TSCN_FLOAT_RE } from './number.js';

/**
 * `Type.deprecated` to the property the setter actually writes.
 *
 * A `Map` of `Map`s, not object literals: both keys come from a `.tscn`, and a
 * plain object answers `constructor`/`__proto__`/`toString` from its prototype.
 * That returned a FUNCTION where the signature promises a string, and the
 * linter threw `propertyKey.startsWith is not a function` on a four-line scene.
 */
const DEPRECATED_PROPERTY_NAMES = toLookup({
  // set_sprite_frames, both dimensions.
  AnimatedSprite2D: { frames: 'sprite_frames' }, // animated_sprite_2d.cpp:617
  AnimatedSprite3D: { frames: 'sprite_frames' }, // sprite_3d.cpp:1495
  // set_horizontal_alignment / set_vertical_alignment.
  Label: { align: 'horizontal_alignment', valign: 'vertical_alignment' }, // label.cpp:1002-1007
  // `_set` is `p_name == "bbcode_text" && !((String)p_value).is_empty()`, so an
  // EMPTY bbcode_text is refused and must not clear `text`.
  RichTextLabel: {
    bbcode_text: { to: 'text', applies: (raw) => literalText(raw) !== '' }, // rich_text_label.cpp:7563
  },
  // `_set` is `p_name == "mode" && p_value.is_num()`: only an INT or FLOAT
  // variant forwards, so a quoted or boolean mode is dropped, not converted.
  PointLight2D: {
    mode: { to: 'blend_mode', applies: isNumericLiteral }, // light_2d.cpp:456-458
  },
  // The Godot-3 navigation vocabulary, renamed wholesale in 4.0. Every one of
  // these passes `p_value` through untouched.
  NavigationRegion2D: { navpoly: 'navigation_polygon' }, // navigation_region_2d.cpp:361
  NavigationRegion3D: { navmesh: 'navigation_mesh' }, // navigation_region_3d.cpp:312
  NavigationLink2D: {
    start_location: 'start_position', // navigation_link_2d.cpp:84
    end_location: 'end_position', // navigation_link_2d.cpp:88
  },
  NavigationLink3D: {
    start_location: 'start_position', // navigation_link_3d.cpp:223
    end_location: 'end_position', // navigation_link_3d.cpp:227
  },
  NavigationAgent2D: {
    target_location: 'target_position', // navigation_agent_2d.cpp:206
    time_horizon: 'time_horizon_agents', // navigation_agent_2d.cpp:202
  },
  NavigationAgent3D: {
    target_location: 'target_position', // navigation_agent_3d.cpp:217
    time_horizon: 'time_horizon_agents', // navigation_agent_3d.cpp:213
    agent_height_offset: 'path_height_offset', // navigation_agent_3d.cpp:221
  },
});

/**
 * What one deprecated spelling forwards to.
 *
 * A bare string is a PURE rename. The object form carries the value test a
 * `_set` arm applies before forwarding: Godot returns false for the rest, and
 * `_setv` then finds no property under the deprecated name, so the write is
 * DROPPED rather than landing on the canonical slot.
 */
type AliasRow = string | { readonly to: string; readonly applies: (raw: string) => boolean };

/**
 * Whether a serialised value is the INT or FLOAT variant `Variant::is_num()`
 * accepts. A quoted `"1"` is a STRING and a `true` is a BOOL; neither is num,
 * so neither forwards.
 *
 * The tokenizer's grammar alone, never `is_valid_int`: the two differ on
 * exactly the leading `+`, which `String::is_valid_int` skips but `get_token`
 * does not. Only `-` is consumed before the digit test
 * (`variant_parser.cpp:420-424`), so `+` falls through to "Unexpected
 * character" (`:508-510`) and `mode = +5` fails the whole file's load. Reading
 * it as numeric renamed the key to `blend_mode`, which left the validator
 * registered under the deprecated spelling silent and put a property name the
 * author's file does not contain into the diagnostic.
 */
function isNumericLiteral(raw: string): boolean {
  return TSCN_FLOAT_RE.test(raw.trim());
}

/** Nested plain literals to nested Maps, so no lookup can reach a prototype. */
function toLookup(table: Record<string, Record<string, AliasRow>>): Map<string, Map<string, AliasRow>> {
  return new Map(Object.entries(table).map(([type, keys]) => [type, new Map(Object.entries(keys))]));
}

/**
 * The property `key` writes on `nodeType`, which is `key` itself unless the
 * type carries a deprecated alias for it.
 *
 * Only the type's OWN table is consulted, never an ancestor's: `_set` is a
 * virtual on the declaring class, so `Label`'s `align` says nothing about any
 * other Control.
 */
export function canonicalPropertyName(
  nodeType: string | undefined,
  key: string,
  /** The serialised value, because two `_set` arms forward only some of them. */
  rawValue: string
): string {
  // A section with no type — `[resource]`, or a heading whose `type=` is absent
  // because the node is instantiated — declares no class, so it aliases nothing.
  if (nodeType === undefined) return key;
  const row = DEPRECATED_PROPERTY_NAMES.get(nodeType)?.get(key);
  if (row === undefined) return key;
  if (typeof row === 'string') return row;
  // `_set` returned false, so nothing claims the key and Godot drops the write.
  // Leaving it under its own spelling keeps it out of the canonical slot while
  // the linter still sees the text the scene carries.
  return row.applies(rawValue) ? row.to : key;
}

/** Whether `key` is a deprecated spelling on `nodeType`. */
export function isDeprecatedPropertyName(nodeType: string | undefined, key: string): boolean {
  return nodeType !== undefined && DEPRECATED_PROPERTY_NAMES.get(nodeType)?.get(key) !== undefined;
}

/**
 * A raw property bag with every deprecated key renamed to what it writes.
 *
 * For the seams that learn the node's type LATER than the scan did. An
 * `[node ... instance=ExtResource("1")]` heading carries no `type=`, so the
 * scanner cannot resolve an alias in an instance override — but the merge that
 * layers that override onto the instanced root's own properties does know the
 * type, and merged the two under different keys. The root's `sprite_frames`
 * then beat the host's `frames` override, which Godot applies.
 *
 * A bag carrying BOTH spellings keeps the one written last, which is the order
 * `_setv` applies them in.
 */
export function canonicalisePropertyBag(
  nodeType: string | undefined,
  raw: Record<string, string>
): Record<string, string> {
  if (nodeType === undefined || DEPRECATED_PROPERTY_NAMES.get(nodeType) === undefined) return raw;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[canonicalPropertyName(nodeType, key, value)] = value;
  }
  return out;
}
