/**
 * AnimationPlayer strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `autoplay` and `root_node` used to hand-roll an empty-string rejection, but
 * animation_player.cpp:775 (`set_autoplay`) and animation_mixer.cpp:484
 * (`set_root_node`) are both bare assignments, and an empty StringName/NodePath
 * is Godot's own "nothing set" state (autoplay: line 150's `animation_set.has(autoplay)`
 * guard; root_node: animation_mixer.cpp:2499 defaults it to `NodePath("..")`, not
 * empty, but nothing refuses an empty one either) — rejecting it was a false
 * positive. Both are now plain `v` combinators matching their real Variant type.
 *
 * `playback/play`, `next/<name>` and `blend_times` are three more hand-rolled
 * `_set`/`_get` keys (animation_player.cpp:36-66), none `ADD_PROPERTY`-declared:
 * see propertyListRouteCoverage.test.ts, which tracks exactly this class of gap.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it. AnimationMixer, not
// Node directly: `anims/<name>`/`libraries`/`libraries/<name>` are its own
// hand-rolled route, and AnimationMixer's own linterParser.ts already chains to
// Node in turn.
import '../animationmixer/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const PROCESS_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };
const METHOD_CALL_MODE = { 0: 'DEFERRED', 1: 'IMMEDIATE' };

const ARRAY_LITERAL_RE = /^\[([\s\S]*)\]$/;

/**
 * Depth/quote-aware split of a bracket body's top-level comma-separated
 * elements, so a `&"…"` StringName containing a comma is never mistaken for a
 * separator. Empty input yields no elements.
 */
function splitTopLevel(body: string): string[] {
  const trimmed = body.trim();
  if (trimmed === '') return [];
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (inQuote) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === '"') inQuote = false;
      continue;
    }
    if (c === '"') {
      inQuote = true;
    } else if (c === '(' || c === '[') {
      depth++;
    } else if (c === ')' || c === ']') {
      depth--;
    } else if (c === ',' && depth === 0) {
      parts.push(trimmed.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(trimmed.slice(start));
  return parts.map((p) => p.trim());
}

/**
 * `blend_times`: a flat Array of (from: StringName, to: StringName, time:
 * float) triples (animation_player.cpp:79-92 builds it, :43-53 reads it back).
 * `ERR_FAIL_COND_V(len % 3, false)` (:46) is a REAL enforced bound: a
 * malformed length drops the whole write.
 *
 * Only the COUNT is checked, not each element's shape. `StringName from =
 * array[i*3+0]` goes through `Variant::operator StringName()`
 * (variant.cpp:1545-1553), which returns an EMPTY StringName for a non-string
 * rather than failing, and `float time = array[i*3+2]` coerces the same
 * permissive way — so Godot loads a non-string/non-number element without
 * complaint, and rejecting one here would refuse a value the engine accepts.
 */
const blendTimesValidator: PropertyValidator = accepts((key, value, line) => {
  const match = ARRAY_LITERAL_RE.exec(value.trim());
  if (!match) {
    return propertyError(
      key,
      line,
      `Property 'blend_times' must be an Array literal like [], got: ${value}`,
      'INVALID_BLEND_TIMES_FORMAT'
    );
  }
  const count = splitTopLevel(match[1]!).length;
  if (count % 3 !== 0) {
    return propertyError(
      key,
      line,
      `Property 'blend_times' must be a flat list of (from, to, time) triples; got ${count} element(s), not a multiple of 3 (animation_player.cpp:46)`,
      'INVALID_BLEND_TIMES_COUNT'
    );
  }
  return null;
}, 'Array literal of (from, to, time) triples');
blendTimesValidator.grounding = { kind: 'enforced', cite: 'animation_player.cpp:46' };

validatorRegistry.registerAll('AnimationPlayer', {
  // animation_player.cpp:1048, PROPERTY_HINT_RANGE "-4,4,0.001,or_less,or_greater":
  // both ends open, and set_speed_scale (:648) is a bare assignment, so the only
  // thing to reject is a non-number.
  speed_scale: v.float('speed_scale'),
  // animation_player.cpp:822 is a bare assignment, so the hint at :1046
  // ("0,4096,0.01") is advisory: out-of-range is a warning in linter.ts.
  playback_default_blend_time: v.float('playback_default_blend_time'),
  // animation_player.cpp:1035/:57-59, redirected through AnimationMixer's
  // callback_mode_process/method (animation_mixer.cpp:501-509,522-525): both
  // bare assignments, no engine-side range check on the raw int.
  playback_process_mode: v.enumInt('playback_process_mode', 0, 2, PROCESS_MODE, {
    hinted: 'animation_mixer.cpp:2471',
  }),
  method_call_mode: v.enumInt('method_call_mode', 0, 1, METHOD_CALL_MODE, {
    hinted: 'animation_mixer.cpp:2472',
  }),
  playback_active: v.boolean('playback_active'),
  // animation_player.cpp:1037, Variant::STRING_NAME, PROPERTY_HINT_NONE.
  // set_autoplay (:770-776) is a bare assignment; empty is "no autoplay".
  autoplay: v.stringName('autoplay'),
  current_animation: v.any(),
  // current_animation_length/current_animation_position (animation_player.cpp:1038-1039)
  // are PROPERTY_HINT_NONE + PROPERTY_USAGE_NONE with an empty setter method name
  // ("", "get_current_animation_length"/"get_current_animation_position"): getter-only
  // and never serialised, so they can never appear in a real .tscn. No validator to carry.

  // animation_player.cpp:38-39,71-73, "For backward compatibility.": `_set`
  // matches on `name.begins_with("playback/play")` and forwards straight into
  // `set_current_animation`, the SAME field `current_animation` above sets —
  // so it gets the SAME (deliberately permissive) treatment, not a stricter
  // one: registering a tighter check on the alias than on the canonical key
  // would be its own kind of bug. Never pushed by `_get_property_list`, so
  // only a hand-edited/legacy scene ever reaches it.
  'playback/play': v.any(),

  // animation_player.cpp:130-138: conditionally pushed only for an animation
  // with a "next" override set, usage NO_EDITOR|INTERNAL — still
  // storage-bearing (object.h:132).
  //
  // `stringName`, not `quotedString`, even though the PropertyInfo declares
  // Variant::STRING: the GETTER decides the serialised form, and
  // `animation_get_next` returns a StringName (animation_player.h:181), so
  // Godot writes `&"idle"`. A quoted-string check rejected the engine's own
  // output — `unit-animation-player.tscn` carries exactly that form.
  'next/*': v.stringName('next'),

  // animation_player.cpp:144 (_get_property_list) / :43-53 (_get) / :79-92
  // (_set): flat Array of (from, to, time) triples, see blendTimesValidator.
  blend_times: blendTimesValidator,
});
