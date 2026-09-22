/**
 * `<StandardMaterialSlot>` keys its material on the parameters three BAKES into
 * the program at first compile (`WebGLPrograms.js:56` `getParameters`), not on
 * the raw scalars. Anything on that list must rebuild the material when it
 * moves, because a `.tscn` re-parse feeds new props to the same mounted element
 * and three re-derives only on a `material.version` bump or one of
 * `WebGLRenderer.js:2388`'s fixed re-checks.
 *
 * The controls matter as much as the cases: a plain uniform must NOT rebuild,
 * or every edit throws away a compiled program for nothing.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { StandardMaterialSlot, type StandardMaterialSlotProps } from './StandardMaterialSlot';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';

type Maps = Omit<StandardMaterialSlotProps, 'scalars'>;

function slot(data: Record<string, string>, maps: Maps) {
  return (
    <mesh>
      <StandardMaterialSlot scalars={parseStandardMaterial3DScalars(data)} {...maps} />
    </mesh>
  );
}

/** Whether the slot handed the mesh a DIFFERENT THREE.Material after the edit. */
async function rebuilds(
  before: Record<string, string>,
  after: Record<string, string>,
  beforeMaps: Maps = {},
  afterMaps: Maps = beforeMaps
): Promise<boolean> {
  const renderer = await ReactThreeTestRenderer.create(slot(before, beforeMaps));
  const materialOf = () =>
    (renderer.scene.findByType('Mesh').instance as unknown as THREE.Mesh).material;
  const first = materialOf();
  await renderer.update(slot(after, afterMaps));
  return materialOf() !== first;
}

/**
 * Seven of the eight slots this component fans out to. `anisotropyMap` is the
 * eighth and is asserted separately: three gates it on `HAS_ANISOTROPY`
 * (`WebGLPrograms.js:147`), and only `MeshPhysicalMaterial` declares
 * `anisotropy` at all (`MeshPhysicalMaterial.js:353`), so on this branch it is
 * provably not a program input.
 */
const TEXTURE_SLOTS: Array<keyof Maps> = [
  'albedoMap',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'displacementMap',
];

const ALPHA = { transparency: '1' };
/** Physical on both sides of every feature case, so the element type never moves. */
const PHYSICAL = { clearcoat_enabled: 'true', clearcoat: '0.5' };
const RIM = { rim_enabled: 'true', rim: '0.5' };

describe('<StandardMaterialSlot> rebuilds when a baked program parameter moves', () => {
  it.each([
    ['transparency 0 → 1 (the `opaque` composite)', {}, ALPHA],
    // ADD both joins the alpha pass and leaves NormalBlending, so it flips two
    // of the composite's three terms at once — Godot admits no way to move the
    // blending term alone.
    ['blend_mode MIX → ADD (the same composite)', {}, { blend_mode: '1' }],
    ['vertex_color_use_as_albedo', {}, { vertex_color_use_as_albedo: 'true' }],
    ['cull_mode BACK → DISABLED (doubleSided/flipSided)', {}, { cull_mode: '2' }],
  ])('%s', async (_case, before, after) => {
    expect(await rebuilds(before, after)).toBe(true);
  });

  it.each(TEXTURE_SLOTS)('%s arriving asynchronously', async (prop) => {
    expect(await rebuilds({}, {}, {}, { [prop]: new THREE.Texture() })).toBe(true);
  });

  it.each([
    ['rim → sheen', PHYSICAL, { rim_enabled: 'true', rim: '0.5' }],
    ['anisotropy', PHYSICAL, { anisotropy_enabled: 'true', anisotropy: '0.5' }],
    ['refraction → transmission', PHYSICAL, { refraction_enabled: 'true' }],
    // Clearcoat is the base in every case above, so it needs a base of its own
    // to cross zero against.
    ['clearcoat', RIM, { clearcoat_enabled: 'true', clearcoat: '0.5' }],
  ])('physical feature crosses zero: %s', async (_case, base, feature) => {
    // Still a MeshPhysicalMaterial on both sides — the base feature holds the
    // upgrade — so nothing but the key can force the rebuild.
    expect(await rebuilds(base, { ...base, ...feature })).toBe(true);
  });

  it('the anisotropy flowmap arriving on an already-anisotropic material', async () => {
    // The real hazard `HAS_ANISOTROPYMAP` (`:147`) describes: the physical
    // branch is already up, `anisotropy > 0`, and the flowmap resolves late.
    const anisotropic = { anisotropy_enabled: 'true', anisotropy: '0.5' };
    expect(await rebuilds(anisotropic, anisotropic, {}, { anisotropyMap: new THREE.Texture() }))
      .toBe(true);
  });


  it('unshaded (MeshBasicMaterial) keys the same composite', async () => {
    const unshaded = { shading_mode: '0' };
    expect(await rebuilds(unshaded, { ...unshaded, ...ALPHA })).toBe(true);
    expect(await rebuilds(unshaded, { ...unshaded, cull_mode: '2' })).toBe(true);
  });
});

describe('<StandardMaterialSlot> keeps the compiled material for a plain uniform', () => {
  it.each([
    ['opacity (albedo alpha under ALPHA)', { ...ALPHA, albedo_color: 'Color(1, 1, 1, 0.25)' }],
    ['albedo colour', { ...ALPHA, albedo_color: 'Color(1, 0, 0, 1)' }],
    ['roughness', { ...ALPHA, roughness: '0.25' }],
    ['metallic', { ...ALPHA, metallic: '0.75' }],
  ])('%s', async (_case, after) => {
    expect(await rebuilds(ALPHA, after)).toBe(false);
  });

  it('blend_mode on a material already in the alpha pass', async () => {
    // `blending` reaches a program ONLY through `opaque` (`WebGLPrograms.js:262`,
    // its sole reference). With `transparent` already true the composite is
    // false either way; the blend equation itself is per-draw GL state.
    expect(await rebuilds(ALPHA, { ...ALPHA, blend_mode: '1' })).toBe(false);
  });

  it('alpha_scissor_threshold: three bumps `version` itself on the zero crossing', async () => {
    // `Material.js:494-502` — the accessor makes alphaTest self-healing, so it
    // is deliberately absent from the key.
    expect(await rebuilds({}, { transparency: '2', alpha_scissor_threshold: '0.3' })).toBe(false);
  });

  it('the anisotropy flowmap while anisotropy is still zero', async () => {
    // Not an omission: `MeshStandardMaterial` has no `anisotropy`
    // (`MeshPhysicalMaterial.js:353`), so `HAS_ANISOTROPY` is false and the slot
    // (`WebGLPrograms.js:147`) cannot be a program input here. Crossing zero
    // switches the ELEMENT type, which remounts on its own.
    expect(await rebuilds({}, {}, {}, { anisotropyMap: new THREE.Texture() })).toBe(false);
  });

  it('a texture slot swapping IDENTITY is presence-unchanged', async () => {
    // three bakes `USE_MAP`, not which texture — a fresh material here would
    // throw away a compiled program for a uniform assignment.
    const first = { albedoMap: new THREE.Texture() };
    const second = { albedoMap: new THREE.Texture() };
    expect(await rebuilds({}, {}, first, second)).toBe(false);
  });
});
