import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { ImageSize } from '../../resources/formats/image/imagePixels';
import type { ScopedReference } from '../../resources/reading';
import type { ShaderTextureReference } from '../../resources/materials/shadermaterial/types';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import type { ShaderSampler } from '../../shaders/uniforms/shaderSamplers';
import { useTexture2DRid } from '../../resources/useTexture2D';
import { useTexture3D } from '../../resources/useTexture3D';
import { useCubemap } from '../../resources/useCubemap';
import { topDownTexture } from '../../resources/textures/topDownTexture';
import { withEntry } from '../../utils/withEntry';
import { elementsOf, samplerValues } from './samplerValues';

/** What a slot reports for its texture: the texture once it loads, and whether more is on its way. */
export interface SlotState {
  readonly texture: THREE.Texture | null;
  /** False once the texture loads, or once nothing more arrives: a missing file or a CanvasTexture. */
  readonly isArriving: boolean;
  /** The size `get_width` and `get_height` report, for a flat texture that has loaded. */
  readonly reportedSize?: ImageSize;
}

type SlotReport = (key: string, state: SlotState | undefined) => void;

const NO_TEXTURES: Readonly<Record<string, SamplerValue>> = {};
const NO_STATES: ReadonlyMap<string, SlotState> = new Map();

/** The texture parameters of a shader and the samplers it declares, by uniform name. */
export interface ShaderTextures {
  readonly references: Readonly<Record<string, ShaderTextureReference>>;
  readonly samplers: Readonly<Record<string, ShaderSampler>>;
}

/** The loaded textures by uniform name, the slots the caller renders, and each slot's state by its key. */
export function useShaderTextures(
  shader: ShaderTextures | null
): [Readonly<Record<string, SamplerValue>>, ReactNode, ReadonlyMap<string, SlotState>] {
  const [states, setStates] = useState<ReadonlyMap<string, SlotState>>(NO_STATES);
  const report = useCallback<SlotReport>((key, state) => {
    setStates((current) => withEntry(current, key, state));
  }, []);
  const references = shader?.references ?? null;
  const textures = useMemo(
    () => (references ? samplerValues(references, loadedTextures(states)) : NO_TEXTURES),
    [references, states]
  );
  if (!shader) return [NO_TEXTURES, null, NO_STATES];
  const slots = Object.entries(shader.references).flatMap(([name, reference]) => {
    // Godot ignores a value no sampler declares.
    const sampler = shader.samplers[name];
    const Slot = sampler && SLOT_OF_KIND[sampler.kind];
    if (!Slot) return [];
    return elementsOf(name, reference).map(
      ([key, element]) =>
        element && (
          <Slot key={key} name={key} reference={element} isColor={sampler.isColor} onState={report} />
        )
    );
  });
  return [textures, slots, states];
}

function loadedTextures(states: ReadonlyMap<string, SlotState>): ReadonlyMap<string, THREE.Texture> {
  const loaded = new Map<string, THREE.Texture>();
  for (const [key, { texture }] of states) if (texture) loaded.set(key, texture);
  return loaded;
}

interface ShaderTextureSlotProps {
  name: string;
  reference: ScopedReference;
  /** `source_color`, which samples a ViewportTexture through its decoding view. */
  isColor: boolean;
  onState: SlotReport;
}

/** A shader samples a texture by RID, so an AtlasTexture names its whole sheet (`atlas_texture.cpp:55`). */
function FlatTextureSlot({ name, reference, isColor, onState }: ShaderTextureSlotProps): null {
  const { texture, isArriving, reportedSize } = useTexture2DRid(reference, isColor ? 'decoding' : 'plain');
  const drawn = texture && topDownTexture(texture);
  const state = useMemo(
    () => ({ texture: drawn, isArriving, reportedSize }),
    [drawn, isArriving, reportedSize]
  );
  useReportedState(name, state, onState);
  return null;
}

// A layered slot reports no arrival: only a generated shader waits on its textures, all flat.
function CubemapSlot({ name, reference, onState }: ShaderTextureSlotProps): null {
  const texture = useCubemap(reference);
  useReportedState(
    name,
    useMemo(() => ({ texture, isArriving: false }), [texture]),
    onState
  );
  return null;
}

function Texture3DSlot({ name, reference, onState }: ShaderTextureSlotProps): null {
  const texture = useTexture3D(reference);
  useReportedState(
    name,
    useMemo(() => ({ texture, isArriving: false }), [texture]),
    onState
  );
  return null;
}

/** A texture array and a cubemap array have no slot: their samplers read the default texture. */
const SLOT_OF_KIND: Readonly<Record<ShaderSampler['kind'], ComponentType<ShaderTextureSlotProps> | null>> = {
  flat: FlatTextureSlot,
  cube: CubemapSlot,
  volume: Texture3DSlot,
  layers: null,
  cubes: null,
};

function useReportedState(name: string, state: SlotState, onState: SlotReport): void {
  useEffect(() => {
    onState(name, state);
    return () => onState(name, undefined);
  }, [name, state, onState]);
}
