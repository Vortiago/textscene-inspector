import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { ScopedReference } from '../../resources/reading';
import type { SkyProperties } from '../../resources/sky/types';
import type { SkySampler } from '../../shaders/sky/skyUsage';
import { useTexture2DRid } from '../../resources/useTexture2D';
import { useTexture3D } from '../../resources/useTexture3D';
import { useCubemap } from '../../resources/useCubemap';
import { topDownTexture } from '../../resources/textures/topDownTexture';
import { withEntry } from '../../utils/withEntry';

type TextureReport = (name: string, texture: THREE.Texture | null) => void;

const NO_TEXTURES: Readonly<Record<string, THREE.Texture>> = {};
const NO_LOADED: ReadonlyMap<string, THREE.Texture> = new Map();

/** The loaded texture parameters by uniform name, and the slots that load them, which the caller renders. */
export function useShaderSkyTextures(
  material: SkyProperties | null
): [Readonly<Record<string, THREE.Texture>>, ReactNode] {
  const [loaded, setLoaded] = useState<ReadonlyMap<string, THREE.Texture>>(NO_LOADED);
  const report = useCallback<TextureReport>((name, texture) => {
    setLoaded((current) => withEntry(current, name, texture ?? undefined));
  }, []);
  const textures = useMemo(() => (loaded.size === 0 ? NO_TEXTURES : Object.fromEntries(loaded)), [loaded]);
  if (material?.kind !== 'shader') return [NO_TEXTURES, null];
  const slots = Object.entries(material.textures).map(([name, reference]) => {
    // Godot ignores a value no sampler declares.
    const sampler = material.usage.samplers[name];
    const Slot = sampler && SLOT_OF_KIND[sampler.kind];
    return (
      Slot && (
        <Slot key={name} name={name} reference={reference} isColor={sampler.isColor} onTexture={report} />
      )
    );
  });
  return [textures, slots];
}

interface ShaderTextureSlotProps {
  name: string;
  reference: ScopedReference;
  /** `source_color`, which samples a ViewportTexture through its decoding view. */
  isColor: boolean;
  onTexture: TextureReport;
}

/** A shader samples a texture by RID, so an AtlasTexture names its whole sheet (`atlas_texture.cpp:55`). */
function FlatTextureSlot({ name, reference, isColor, onTexture }: ShaderTextureSlotProps): null {
  const { texture } = useTexture2DRid(reference, isColor ? 'decoding' : 'plain');
  useReportedTexture(name, texture && topDownTexture(texture), onTexture);
  return null;
}

function CubemapSlot({ name, reference, onTexture }: ShaderTextureSlotProps): null {
  useReportedTexture(name, useCubemap(reference), onTexture);
  return null;
}

function Texture3DSlot({ name, reference, onTexture }: ShaderTextureSlotProps): null {
  useReportedTexture(name, useTexture3D(reference), onTexture);
  return null;
}

/** A texture array and a cubemap array have no slot: their samplers read the default texture. */
const SLOT_OF_KIND: Readonly<Record<SkySampler['kind'], ComponentType<ShaderTextureSlotProps> | null>> = {
  flat: FlatTextureSlot,
  cube: CubemapSlot,
  volume: Texture3DSlot,
  layers: null,
  cubes: null,
};

function useReportedTexture(name: string, texture: THREE.Texture | null, onTexture: TextureReport): void {
  useEffect(() => {
    onTexture(name, texture);
    return () => onTexture(name, null);
  }, [name, texture, onTexture]);
}
