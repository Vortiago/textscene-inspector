/**
 * `canvasItemProgramKey()` — the React `key` a 2D canvas material carries so
 * that a texture arriving LATE reaches the shader and not just the material.
 *
 * three bakes a material's `map` presence and its `defines` into the program
 * SOURCE — `USE_MAP` and the define block are written once, at the compile
 * `WebGLRenderer.setProgram` performs for that material. `setProgram` re-derives
 * a program only when `material.version` has moved past the compiled one, or for
 * the short list of state it re-examines itself (lights, output colour space,
 * batching/instancing/skinning, `envMap`, fog, clipping planes, vertex alphas,
 * morphs, tone mapping) — a map appearing where there was none is not on that
 * list, and neither is a `defines` entry. So a material compiled while its
 * texture was still loading samples nothing forever: the polygon paints its flat
 * fill colour over the whole shape, however correctly `map` is assigned after.
 *
 * Nothing upstream bumps `material.needsUpdate` for us. `@react-three/fiber`'s
 * `applyProps` assigns `root[key] = value` and stops (fiber 9.6.1 dist), which
 * is the same reason `useCanvasItemLighting` owns its uniform objects for an
 * item's whole life instead of rebuilding them. Worse for `defines`
 * specifically: `applyProps` SKIPS an `undefined` value outright ("Ignore
 * setting undefined props"), so defines that stop applying — a `Sprite2D` whose
 * texture swaps from a `res://` file to a ViewportTexture that keeps its own
 * colour space — cannot even be CLEARED through the prop, and the material would
 * keep decoding a sample that no longer needs it.
 *
 * Hence a key rather than a `needsUpdate` bump: React remounts the element,
 * R3F constructs a fresh material, and its first and only compile sees the
 * finished set. `r3f/materials/StandardMaterialSlot.tsx` keys a 3D material's
 * texture slots the same way and for the same reason.
 *
 * The key must depend ONLY on what the program depends on. A texture swapped for
 * another texture — an `AnimatedSprite2D` advancing a frame, a `Sprite2D`
 * re-regioned — compiles to the same program, and remounting a material per
 * animation frame would throw away a program per frame to no effect.
 *
 * Why this was invisible until canvas materials became single-pass: a
 * `transparent` + `DoubleSide` material with `forceSinglePass === false` is
 * drawn TWICE per frame by `renderObject`, which sets `material.needsUpdate =
 * true` before each pass (`three.module.js`, `WebGLRenderer.renderObject`). Every
 * 2D canvas material was therefore recompiled every frame, and picked up
 * whatever had arrived since. `canvasItemFacing()` removed the second pass, and
 * with it an accidental recompile the canvas had been leaning on.
 */
import type * as THREE from 'three';

/**
 * The React `key` for a material sampling `map` with `defines`:
 *
 *   <meshBasicMaterial key={canvasItemProgramKey(map, defines)} map={map} … />
 *
 * `defines` is the value `useCanvasDecodeDefines` returns (`undefined` for a
 * texture that needs no decode). Its KEYS are what reach the shader, so two
 * different define sets are two different programs and a same-shaped set is one.
 */
export function canvasItemProgramKey(
  map: THREE.Texture | null | undefined,
  defines?: Record<string, string> | undefined
): string {
  const declared = defines ? Object.keys(defines).sort().join('+') : '';
  return `${map ? 'map' : 'unmapped'}${declared ? `-${declared}` : ''}`;
}
