/**
 * Property names Godot still accepts under their pre-4.0 spelling.
 *
 * A `#ifndef DISABLE_DEPRECATED` `_set` override forwards the old name to the
 * current setter and returns `true`, so the file loads and the property takes
 * effect — `AnimatedSprite2D::_set` (`animated_sprite_2d.cpp:616-618`) hands
 * `frames` straight to `set_sprite_frames`. To every reader in this codebase
 * the old spelling is simply the same field under another name.
 *
 * PURE RENAMES ONLY. Many `_set` overrides also TRANSFORM the value —
 * `Decal`/`RectangleShape2D`/`BoxShape3D`/`VoxelGI` and six
 * `GPUParticlesCollision*` types all map `extents` to `set_size(p_value * 2)`,
 * and `StandardMaterial3D` maps a Godot-3 boolean onto an enum setter. Renaming
 * the key would make the linter validate the right slot while the RENDERER read
 * a value twice the size it should be, so those need a transform, not a table
 * row, and are deliberately absent.
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
 * nowhere in the user's file and cannot be grepped for. A deprecated key
 * therefore gets no FORMAT validation, which is what it got before this table
 * existed; the rules, which read the bag, are what the aliases exist to fix.
 * `nodes/2d/bone2d/linterParser.ts:64-70` is the pattern for adding format
 * coverage back per key, under the name the scene carries.
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
  RichTextLabel: { bbcode_text: 'text' }, // rich_text_label.cpp:7563
  PointLight2D: { mode: 'blend_mode' }, // light_2d.cpp:457
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

/** Nested plain literals to nested Maps, so no lookup can reach a prototype. */
function toLookup(table: Record<string, Record<string, string>>): Map<string, Map<string, string>> {
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
export function canonicalPropertyName(nodeType: string | undefined, key: string): string {
  // A section with no type — `[resource]`, or a heading whose `type=` is absent
  // because the node is instantiated — declares no class, so it aliases nothing.
  if (nodeType === undefined) return key;
  return DEPRECATED_PROPERTY_NAMES.get(nodeType)?.get(key) ?? key;
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
 * The canonical key wins when a bag somehow carries both, matching the
 * last-write-wins order `_setv` gives a file that spells both.
 */
export function canonicalisePropertyBag(
  nodeType: string | undefined,
  raw: Record<string, string>
): Record<string, string> {
  if (nodeType === undefined || DEPRECATED_PROPERTY_NAMES.get(nodeType) === undefined) return raw;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[canonicalPropertyName(nodeType, key)] = value;
  }
  return out;
}
