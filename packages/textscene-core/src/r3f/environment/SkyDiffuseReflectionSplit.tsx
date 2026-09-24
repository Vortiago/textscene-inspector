/**
 * Splits sky diffuse from reflection, which three couples under one `environmentIntensity`: Godot
 * scales diffuse by `ambient_light_sky_contribution` while a metal reflects the whole sky. Each
 * material gets `envMapIntensity = contribution + metalness · (1 − contribution)`, so a dielectric
 * keeps `contribution` (0 under a COLOR ambient). A no-op at `contribution >= 1`.
 */

import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MaterialHolders } from './materialHolders';

/** What a material held before the split, restored when the split ends. */
export interface EnvMapOriginal {
  envMap: THREE.Texture | null;
  intensity: number;
}

export function SkyDiffuseReflectionSplit({
  contribution,
  active,
}: {
  contribution: number;
  active: boolean;
}) {
  const scene = useThree((s) => s.scene);
  const originals = useRef(new Map<THREE.MeshStandardMaterial, EnvMapOriginal>());
  /** Created by the first frame that splits, disposed with the split. */
  const holders = useRef<MaterialHolders | null>(null);

  // Stamped every frame, since materials arrive across frames (async textures, GLB and instanced
  // sub-scenes) and a mesh can swap its material with no event. three ignores `envMapIntensity`
  // unless the material owns its `envMap` (`material.envMap === null && scene.environment !== null`
  // in WebGLRenderer), so each points its own `envMap` at the same PMREM texture, with no recompile.
  useFrame(() => {
    if (!active || contribution >= 1) return;
    const environment = scene.environment;
    if (!environment) return;
    holders.current ??= new MaterialHolders(scene);
    splitSkyDiffuse(holders.current.current(), environment, contribution, originals.current);
  });

  // Restores what was found, because the materials outlive any one environment.
  useEffect(() => {
    const captured = originals.current;
    return () => {
      holders.current?.dispose();
      holders.current = null;
      for (const [mat, orig] of captured) {
        mat.envMap = orig.envMap;
        mat.envMapIntensity = orig.intensity;
      }
      captured.clear();
    };
  }, [scene, contribution, active]);

  return null;
}

/**
 * Stamp the split onto every material `holders` carry. A material already holding its stamp is
 * left untouched, so a still scene writes nothing and allocates nothing. `originals` gains an
 * entry the first time a material is stamped: until then it still holds what it was found with.
 */
export function splitSkyDiffuse(
  holders: readonly THREE.Object3D[],
  environment: THREE.Texture,
  contribution: number,
  originals: Map<THREE.MeshStandardMaterial, EnvMapOriginal>
): void {
  for (let i = 0; i < holders.length; i += 1) {
    const material = (holders[i] as THREE.Mesh).material;
    if (Array.isArray(material)) {
      for (let j = 0; j < material.length; j += 1) {
        stampMaterial(material[j]!, environment, contribution, originals);
      }
    } else if (material) {
      stampMaterial(material, environment, contribution, originals);
    }
  }
}

function stampMaterial(
  material: THREE.Material,
  environment: THREE.Texture,
  contribution: number,
  originals: Map<THREE.MeshStandardMaterial, EnvMapOriginal>
): void {
  const std = material as THREE.MeshStandardMaterial;
  if (typeof std.envMapIntensity !== 'number') return;
  const metalness = std.metalness ?? 0;
  const intensity = contribution + metalness * (1 - contribution);
  if (std.envMap === environment && std.envMapIntensity === intensity) return;
  if (!originals.has(std)) {
    originals.set(std, { envMap: std.envMap, intensity: std.envMapIntensity });
  }
  std.envMap = environment;
  std.envMapIntensity = intensity;
}
