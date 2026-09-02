/**
 * Variant to fixed-width integer, as the engine converts on a property write.
 *
 * `_to_int<T>` (`variant.h:360-377`) switches on the Variant's type, and the two
 * branches behave differently enough that callers must pick one deliberately:
 *
 * - `case INT: return T(_data._int)` (`:367-368`) — int64 to T. PORTABLE: a
 *   value inside uint32 wraps the same way on every platform Godot ships, so
 *   the stored number can be named in a diagnostic.
 * - `case FLOAT: return T(_data._float)` (`:369-370`) — double to T. Undefined
 *   behaviour for a non-finite or out-of-range double, and architecture-
 *   specific in practice, so the stored number must NOT be named. See
 *   {@link asStoredInt}.
 *
 * Which width applies is a per-SLOT fact — the setter's argument type or a
 * container's element type — never a parse fact, so it goes IN as
 * {@link IntWidth} rather than being applied to a result. Godot serialises a
 * negative enum in its unsigned form (`clip_children = -1` is written
 * `4294967295`), so a reader that skips the narrowing sees a value the engine
 * never holds.
 *
 * Every reader here narrows, including the ones the RENDER path uses. The
 * previewer and the linter must agree on what one literal means: while
 * `storedInt` did not narrow, `z_index = 4294967295` drew at z = 4.29e8 —
 * behind the camera — and the linter, reading the -1 Godot holds, found it in
 * range and said nothing at all.
 */

export { toInt32, toUint32, toUint8, toInt16, INT32_MAX, readerLimitedInt } from './intWidth.js';
export type { IntWidth } from './intWidth.js';
export { parseGodotInt, storedFromFloat } from './intReader.js';
export { ruleInt, ruleCount, storedInt, slotComponents, slotComponentsAltered } from './intSlots.js';
