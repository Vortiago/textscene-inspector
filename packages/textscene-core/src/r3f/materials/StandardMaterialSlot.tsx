/**
 * `<StandardMaterialSlot>`: the reactive adapter that mounts the bags from `useSurfaceMaterial`
 * as the JSX tag R3F prop-diffs. It derives nothing, as `build.ts` does not. Inside a
 * GeometryInstance3D drawer it mounts the unfaded and the alpha-pass bag, which the cull swaps.
 */

import type * as THREE from 'three';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import { composeInjections, materialProgramInputs } from '../materialProgramInputs';
import type { MaterialAttach } from './swappedMaterials';
import { FadedMaterials } from './FadedMaterials';
import { bindHeightmap } from './godotParallax';
import { withLineDraw, withPointDraw, type ListedPlacement, type PointDraw } from './godotPoint';
import type { ParticleDraw, ParticleProgram } from './godotParticles';
import type { FadeVariants } from './fadeVariants';
import { bindLightmap, LIGHTMAP_PROGRAM, readsLightmap } from '../lightmap/lightmapProgram';
import type { LightmapAssignment } from '../lightmap/sceneLightmaps';
import { useInstanceLightmap } from '../visibilityRange/geometryInstance';
import { LitNodeMaterial } from '../litSurface/LitNodeMaterial';
import { litSurfaceMaterial } from '../litSurface/litSurfaceMaterial';

interface StandardMaterialSlotProps {
  /** The surface's derived bags, textures bound. */
  bags: FadeVariants<StandardMaterialBag>;
  /** R3F attach key: `material-0` for multi-surface meshes. */
  attach?: string;
  draws?: SurfaceDraws;
}

/** How a material draws a surface that is not one plain mesh. */
export interface SurfaceDraws {
  /** How it draws the points of a surface that draws `THREE.Points`. */
  pointDraw?: PointDraw;
  /** Where the segments sit when the surface draws `THREE.LineSegments`. */
  linePlacement?: ListedPlacement;
  /** How it draws a particle emitter's instances, and the patch that draws them so. */
  particles?: { draw: ParticleDraw; program: ParticleProgram };
}

export function StandardMaterialSlot({ bags, attach, draws = {} }: StandardMaterialSlotProps) {
  const lightmap = useInstanceLightmap();
  return (
    <FadedMaterials attach={attach}>
      {(pass, mount) =>
        materialBagElement(drawnBag(bags[pass], draws), mount, pass === 'unfaded' ? lightmap : null)
      }
    </FadedMaterials>
  );
}

/** `bag` as a material for the surface `draws` describes. */
export function drawnBag(
  bag: StandardMaterialBag,
  { pointDraw, linePlacement, particles }: SurfaceDraws
): StandardMaterialBag {
  const drawn = withLineDraw(withPointDraw(bag, pointDraw), linePlacement);
  return particles ? particles.program(drawn, particles.draw) : drawn;
}

/**
 * A derived bag as its class's JSX tag, reading `lightmap` where it reads one, or as the shader
 * module's lit material where the port covers it. The missing-texture placeholder mounts through it too.
 */
export function materialBagElement(
  bag: StandardMaterialBag,
  attach: string | MaterialAttach | undefined,
  lightmap: LightmapAssignment | null
) {
  const heightmapTexture = bag.heightmapTexture ?? null;
  const readLightmap =
    lightmap && readsLightmap(bag.materialClass !== 'basic', bag.props.transparent === true)
      ? lightmap
      : null;
  // A ref, not a prop: three's classes have no heightmap or lightmap field, and a rebind needs no
  // remount.
  const binds = (material: THREE.Material | null) => {
    if (!material) return;
    bindHeightmap(material, heightmapTexture);
    bindLightmap(material, readLightmap);
  };
  // A surface that reads a lightmap keeps the classic material: the port draws no lightmap yet.
  const lit = readLightmap ? null : litSurfaceMaterial(bag);
  if (lit) return <LitNodeMaterial key={lit.key} lit={lit} attach={attach} />;
  const injection = composeInjections([bag.injection, readLightmap ? LIGHTMAP_PROGRAM : undefined]);
  // `attach` and the ref first: they are the mount's own props and must never shadow a derived
  // one. The key comes from the same merged bag it travels with (ADR-0038): a program input
  // arriving late, or a moved `attach`, reaches three only through a remount.
  const program = materialProgramInputs({ props: { attach, ref: binds, ...bag.props, injection } });
  switch (bag.materialClass) {
    case 'basic':
      return <meshBasicMaterial key={program.key} {...program.props} />;
    case 'physical':
      return <meshPhysicalMaterial key={program.key} {...program.props} />;
    default:
      return <meshStandardMaterial key={program.key} {...program.props} />;
  }
}
