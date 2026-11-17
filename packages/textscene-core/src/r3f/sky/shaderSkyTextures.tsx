import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { ScopedReference } from '../../resources/reading';
import type { SkyProperties } from '../../resources/sky/types';
import { useTexture2DRid } from '../../resources/useTexture2D';
import { topDownTexture } from '../../resources/textures/topDownTexture';

type TextureReport = (name: string, texture: THREE.Texture | null) => void;

const NO_TEXTURES: Readonly<Record<string, THREE.Texture>> = {};

/** The loaded texture parameters by uniform name, and the slots that load them, which the caller renders. */
export function useShaderSkyTextures(
  material: SkyProperties
): [Readonly<Record<string, THREE.Texture>>, ReactNode] {
  const [textures, setTextures] = useState(NO_TEXTURES);
  const report = useCallback<TextureReport>((name, texture) => {
    setTextures((current) => withTexture(current, name, texture));
  }, []);
  if (material.kind !== 'shader') return [NO_TEXTURES, null];
  const colorSamplers = new Set(material.usage.colorSamplers);
  const slots = Object.entries(material.textures).map(([name, reference]) => (
    <ShaderTextureSlot
      key={name}
      name={name}
      reference={reference}
      isColor={colorSamplers.has(name)}
      onTexture={report}
    />
  ));
  return [textures, slots];
}

/** `current` with `name` set to `texture`, or without it for null. The same map when nothing changes. */
export function withTexture(
  current: Readonly<Record<string, THREE.Texture>>,
  name: string,
  texture: THREE.Texture | null
): Readonly<Record<string, THREE.Texture>> {
  if ((current[name] ?? null) === texture) return current;
  const next = { ...current };
  if (texture) next[name] = texture;
  else delete next[name];
  return next;
}

interface ShaderTextureSlotProps {
  name: string;
  reference: ScopedReference;
  /** `source_color`, which samples a ViewportTexture through its decoding view. */
  isColor: boolean;
  onTexture: TextureReport;
}

/** A shader samples a texture by RID, so an AtlasTexture names its whole sheet (`atlas_texture.cpp:55`). */
function ShaderTextureSlot({ name, reference, isColor, onTexture }: ShaderTextureSlotProps): null {
  const { texture } = useTexture2DRid(reference, isColor ? 'decoding' : 'plain');
  useEffect(() => {
    onTexture(name, texture && topDownTexture(texture));
    return () => onTexture(name, null);
  }, [name, texture, onTexture]);
  return null;
}
