/**
 * `<StandardMaterialSlot>`: the reactive adapter that mounts the derived bags' class as the JSX
 * tag R3F prop-diffs, for every StandardMaterial3D-bearing node. It derives nothing:
 * `useSurfaceMaterial` hands it the bags, `materialBag.ts` holds the class choice and every
 * mapping, and the imperative `build.ts` reads them too. Inside a GeometryInstance3D drawer it
 * mounts the unfaded and the alpha-pass bag, which the cull swaps.
 */

import type * as THREE from 'three';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';
import { composeInjections, materialProgramInputs } from '../materialProgramInputs';
import type { MaterialAttach } from './swappedMaterials';
import { FadedMaterials } from './FadedMaterials';
import { bindHeightmap } from './godotParallax';
import { withPointDraw, type PointDraw } from './godotPoint';
import type { FadeVariants } from './fadeVariants';
import { bindLightmap, LIGHTMAP_PROGRAM, readsLightmap } from '../lightmap/lightmapProgram';
import type { LightmapAssignment } from '../lightmap/sceneLightmaps';
import { useLightmapAssignment } from '../lightmap/useLightmapAssignment';

interface StandardMaterialSlotProps {
  /** The surface's derived bags, textures bound. */
  bags: FadeVariants<StandardMaterialBag>;
  /** R3F attach key: `material-0` for multi-surface meshes. */
  attach?: string;
  /** How the material draws the points of a surface that draws `THREE.Points`. */
  pointDraw?: PointDraw;
}

export function StandardMaterialSlot({ bags, attach, pointDraw }: StandardMaterialSlotProps) {
  const lightmap = useLightmapAssignment();
  return (
    <FadedMaterials attach={attach}>
      {(pass, mount) =>
        materialBagElement(withPointDraw(bags[pass], pointDraw), mount, pass === 'unfaded' ? lightmap : null)
      }
    </FadedMaterials>
  );
}

/**
 * A derived bag as its class's JSX tag, reading `lightmap` where it reads one. The missing-texture
 * placeholder mounts through it too.
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
