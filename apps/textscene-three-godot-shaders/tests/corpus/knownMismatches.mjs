/**
 * The corpus shaders on which the transpiler disagrees with Godot now, each with the issue that
 * owns the fault. The list only shrinks: a mismatch not listed here fails the test, and a listed
 * shader that agrees with Godot fails it too, so the pull request that fixes it removes it.
 */

export const KNOWN_MISMATCHES = {};
