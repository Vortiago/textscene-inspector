/**
 * What every draw of a particle emitter's instances shares: the instanced attributes, the record a
 * draw leaves on its material, and the cameras its billboards face (`material.cpp:1260-1351`).
 * The vertex stage itself is `godotParticlesProgram.ts`.
 */

import * as THREE from 'three';
import type { ProgramInjection } from '../materialProgramInputs';
import {
  surfaceBillboard,
  type StandardMaterialBag,
  type SurfaceBillboard,
} from '../../resources/materials/standardmaterial3d/materialBag';
import {
  PARTICLES_ANIM_DEFAULTS,
  type ParticlesAnim,
  type StandardMaterial3DScalars,
} from '../../resources/materials/standardmaterial3d/types';

/** The instanced attribute that holds each particle's colour, the buffer's floats 12 to 15. */
export const PARTICLE_COLOR_ATTRIBUTE = 'particleColor';
/** The instanced attribute that holds each particle's custom data: angle, phase, frame and age. */
export const PARTICLE_CUSTOM_ATTRIBUTE = 'particleCustom';

/** Where a particle draw records itself, for the shadow pass to draw the instances alike. */
export const PARTICLE_DRAW_KEY = 'godotParticleDraw';

/** How a material draws the instances of a particle emitter. */
export interface ParticleDraw {
  billboard: SurfaceBillboard;
  /** The flipbook, which only BILLBOARD_PARTICLES cuts. */
  anim: ParticlesAnim;
}

/**
 * The program patch that colours and billboards a particle emitter's instances
 * (`godotParticlesProgram.ts`). The particle draw hands it to its slots, so the shader text loads
 * with the draw's own chunk, off the initial-paint path.
 */
export type ParticleProgram = (bag: StandardMaterialBag, draw: ParticleDraw) => StandardMaterialBag;

/** The particle draw of `scalars`, or Godot's default surface for none. */
export function particleDrawOf(scalars: StandardMaterial3DScalars | null): ParticleDraw {
  return { billboard: surfaceBillboard(scalars), anim: scalars?.particlesAnim ?? PARTICLES_ANIM_DEFAULTS };
}

/**
 * The main camera's world matrix, which ENABLED and FIXED_Y read as `MAIN_CAM_INV_VIEW_MATRIX`, the
 * main camera even on a shadow pass (`material.cpp:1263-1264`). One value for every program, as it is
 * one camera for every draw of a render. Written only by {@link aimParticleBillboards}.
 */
export const MAIN_CAMERA_WORLD: THREE.IUniform<THREE.Matrix4> = { value: new THREE.Matrix4() };

/**
 * The world matrix of the camera this pass draws through, which PARTICLES reads as `INV_VIEW_MATRIX`,
 * a uniform in Godot too. A uniform, not `inverse( viewMatrix )`: no matrix inverse per vertex.
 * Written only by {@link aimParticleBillboards}.
 */
export const PASS_CAMERA_WORLD: THREE.IUniform<THREE.Matrix4> = { value: new THREE.Matrix4() };

/** Whether `material` draws a particle emitter's particles, which its program places and billboards. */
export function drawsParticles(material: THREE.Material): boolean {
  return material.userData[PARTICLE_DRAW_KEY] !== undefined;
}

/**
 * Aims every ENABLED and FIXED_Y particle billboard at `mainCamera`, and every PARTICLES billboard
 * at `passCamera`, before a draw of `material`. Each render writes its own cameras, so a
 * SubViewport's draws aim at the SubViewport's.
 */
export function aimParticleBillboards(
  material: THREE.Material,
  mainCamera: THREE.Camera,
  passCamera: THREE.Camera
): void {
  if (!drawsParticles(material)) return;
  MAIN_CAMERA_WORLD.value.copy(mainCamera.matrixWorld);
  PASS_CAMERA_WORLD.value.copy(passCamera.matrixWorld);
}

/**
 * What a depth draw compiles with to cast a particle emitter's shadow as its colour pass draws the
 * instances, the light's view standing for the camera's. Undefined for a surface that draws none.
 */
export function particleShadowInjection(userData: Record<string, unknown>): ProgramInjection | undefined {
  return userData[PARTICLE_DRAW_KEY] as ProgramInjection | undefined;
}
