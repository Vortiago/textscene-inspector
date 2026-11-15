/** The arguments each built-in writes, by index (`builtin_func_out_args`). */
export const OUT_ARGUMENTS: Readonly<Record<string, readonly number[]>> = {
  modf: [1],
  umulExtended: [2, 3],
  imulExtended: [2, 3],
  uaddCarry: [2],
  usubBorrow: [2],
  ldexp: [1],
  frexp: [1],
};

// Godot checks these as places, but GLSL only reads them (shader_language.cpp:3543).
export const READ_PLACES: Readonly<Record<string, readonly number[]>> = { ldexp: [1] };
