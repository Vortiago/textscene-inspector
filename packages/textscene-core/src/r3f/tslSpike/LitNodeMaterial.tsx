/**
 * Mounts the spike's lit node material for a surface its TSL port covers: a `standard` bag with no
 * map, no blend and no program injection but a ported diffuse mode. Every other surface keeps its
 * patched classic material, so both kinds draw in one frame.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag.js';
import { lightModesInjection } from '../lightModes.js';
import { GODOT_DEFAULT_LIGHT_MODES } from '../materials/godotDefaultMaterial.js';
import type { MaterialAttach } from '../materials/swappedMaterials.js';
import type { DiffuseMode } from './godotLightFunctions.js';
import { GodotLitNodeMaterial, type LitSurfaceInputs } from './litSurfaceMaterial.js';
import { nodesHandlerInputs } from './nodesHandler.js';

/** Godot's default material draws Lambert diffuse and GGX specular (`godotDefaultMaterial.ts`). */
const LAMBERT_CACHE_KEY = lightModesInjection(GODOT_DEFAULT_LIGHT_MODES)?.cacheKey;

/** The diffuse mode a bag's injection asks for, or null when it asks for anything the port lacks. */
function portedDiffuseMode(bag: StandardMaterialBag): DiffuseMode | null {
  if (!bag.injection) return 'burley';
  return bag.injection.cacheKey === LAMBERT_CACHE_KEY ? 'lambert' : null;
}

function bindsTexture(props: object): boolean {
  return Object.values(props).some((value) => value instanceof THREE.Texture);
}

/** The diffuse mode of a surface the port covers, or null for one that keeps its classic material. */
function portedSurface(bag: StandardMaterialBag): DiffuseMode | null {
  if (bag.materialClass !== 'standard' || bag.heightmapTexture) return null;
  const { props } = bag;
  if (props.transparent || props.alphaTest || props.alphaHash || props.vertexColors) return null;
  if (bindsTexture(props)) return null;
  return portedDiffuseMode(bag);
}

interface LitNodeMaterialProps {
  inputs: LitSurfaceInputs;
  diffuseMode: DiffuseMode;
  bag: StandardMaterialBag;
  attach: string | MaterialAttach | undefined;
}

function LitNodeMaterial({ inputs, diffuseMode, bag, attach }: LitNodeMaterialProps) {
  const material = useMemo(() => new GodotLitNodeMaterial(inputs, diffuseMode), [inputs, diffuseMode]);
  useEffect(() => () => material.dispose(), [material]);
  const { color, roughness, metalness, side, userData } = bag.props as THREE.MeshStandardMaterialParameters;
  return (
    <primitive
      object={material}
      attach={attach}
      color={color}
      roughness={roughness}
      metalness={metalness}
      side={side}
      userData={userData}
    />
  );
}

/**
 * The node material for `bag`, or null on a page without the nodes handler, for a surface that
 * reads a lightmap, and for a surface the port does not cover.
 */
export function litNodeMaterialElement(
  bag: StandardMaterialBag,
  attach: string | MaterialAttach | undefined,
  readsLightmap: boolean
) {
  const inputs = nodesHandlerInputs();
  if (!inputs || readsLightmap) return null;
  const diffuseMode = portedSurface(bag);
  if (!diffuseMode) return null;
  return (
    <LitNodeMaterial key={diffuseMode} inputs={inputs} diffuseMode={diffuseMode} bag={bag} attach={attach} />
  );
}
