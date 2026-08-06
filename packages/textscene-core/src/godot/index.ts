/**
 * Godot engine facts, with ZERO dependencies.
 *
 * The one module in `src/` that every other domain may import freely — linter,
 * parser, resources, nodes, r3f alike — because it imports nothing itself and so
 * can never carry a domain's weight into another's bundle.
 *
 * What belongs here: a constant or pure function that is a fact about the ENGINE
 * rather than about this codebase, and that more than one domain needs.
 * `CMP_EPSILON` is the founding case: the linter grounds bounds on it and the
 * resource pipeline samples curves with it, and neither should have to import
 * the other, nor re-declare the number and let the two drift.
 *
 * What does NOT belong here: anything touching `ParseError`, `PropertyValidator`,
 * THREE, React, or a node/resource type. Those are domain concepts, and admitting
 * one would give this module the dependency it exists to be free of.
 *
 * `noDependencies.test.ts` enforces the rule, since it is one an ordinary review
 * cannot see: a single added import silently converts this from a leaf into a
 * bridge between two bundles.
 *
 * ## One file per engine area, never one file of constants
 *
 * A file here is named for the part of Godot it describes — `math.ts` for
 * `math_defs.h`/`math_funcs.h`, `string.ts` for `ustring.cpp`'s parses — so a
 * reader looking for a fact knows where it is, and so each file's docblock can
 * explain ONE area properly. A single `constants.ts` would collect unrelated
 * facts behind one name and grow a docblock nobody reads; the value here is the
 * reasoning attached to each fact, and that only survives if the files stay
 * small and topical. Add a new file rather than a new section.
 */

export { CMP_EPSILON, isZeroApprox, isEqualApprox } from './math.js';
export { IS_VALID_INT_RE } from './string.js';
export { MATERIAL_RENDER_PRIORITY_MIN, MATERIAL_RENDER_PRIORITY_MAX } from './rendering.js';
