/** `String`'s parsing behaviour, as the engine defines it. */

/**
 * The spelling `String::is_valid_int()` accepts: an optional single sign, then
 * digits, and nothing else.
 *
 * The sign class is `[+-]?`, not `-?`. A leading `+` is a real spelling Godot
 * reads, and admitting it in one regex while a sibling rejects it has already
 * cost a false positive here: a `settings/+0/…` key entered no index map and its
 * sibling reported a write the engine applies.
 *
 * NOT the same as `to_int()`, which is the other of Godot's two integer parses:
 * `to_int` SKIPS non-digits rather than stopping at them (`ustring.cpp:2268-2298`),
 * so `"x"` reads as 0 and `"a1b2"` as 12, and text this regex rejects still
 * resolves to a number under it. Which parse a class uses decides whether a
 * non-numeric index is a dropped write or a landed one, so never substitute one
 * for the other — see `indexedFamilyValidator`'s `indexParse` option.
 *
 * No `g` flag, so `.test()` on the shared instance is stateless.
 */
export const IS_VALID_INT_RE = /^[+-]?\d+$/;
