# A float library function runs as Godot's C library computes it

- Status: Accepted.
- Related: ADR-0076 (Godot's shaders run through one transpiler).

## Context

Godot hands a `real_t` call of `Math::sin`, `Math::acos` or `Math::atan2` to the `sinf`, `acosf` or
`atan2f` of the C library (`core/math/math_funcs.h`). The reference Godot links glibc 2.39. Its
float functions are not all correctly rounded, so they differ from `Math.fround` of V8's double
answer in the last bit for some inputs. An expression in an `#if` condition, a transform and a
colour conversion can carry that bit into a value the previewer compares with Godot.

The packages are MIT. glibc carries code under three licences: the Sun notice, the MIT licence of
Arm Optimized Routines, and the LGPL.

## Decision

**A float library function that Godot calls is ported bit for bit when its source carries the Sun
notice or the MIT licence. A function whose source is LGPL is not ported: it stays correctly
rounded, and each case where Godot differs is listed with both answers.**

- `acosf` and `atan2f` are ported from glibc (`e_acosf.c`, `e_atan2f.c`, `s_atanf.c`), under the
  Sun notice (`realAcos.ts`, `realAtan2.ts`).
- `sinf` and `cosf` are ported from Arm Optimized Routines, under MIT (`realSin.ts`). glibc builds
  them with fused multiply-adds on a CPU that has them, so the port emulates each fused step.
- `asinf` is LGPL glibc code. Atle chose to keep the correctly rounded arc sine (decision card,
  2026-11-16). It differs from glibc on 4,581,700 of 2,130,706,434 floats in [-1, 1].
- A double library function runs V8's `Math`.
- Each port records its source and licence in its header and in `THIRD-PARTY-NOTICES.md`.

## Consequences

- A value built from `acosf`, `atan2f`, `sinf` or `cosf` equals Godot's bit for bit.
- A value built from `asinf`, or from a double function where V8 and glibc differ, can differ from
  Godot by one bit. `tests/expressions/libmDifferences.mjs` in the shader package lists each such
  case with Godot's answer, the port's answer and the reason. The list test fails when either
  answer changes.
- A new library function goes through the same choice: port it when its licence is the Sun notice
  or MIT, and ask Atle when it is not.
