import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { ImageSize } from '../../resources/formats/image/imagePixels';
import type { ScopedReference } from '../../resources/reading';
import type { ShaderTextureReference } from '../../resources/materials/shadermaterial/types';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';
import type { ShaderSampler } from '../../shaders/uniforms/shaderSamplers';
import { useTexture2DRid } from '../../resources/useTexture2D';
import { useTexture3DState } from '../../resources/useTexture3D';
import { useCubemapState } from '../../resources/useCubemap';
import { topDownTexture } from '../../resources/textures/topDownTexture';
import { withEntry } from '../../utils/withEntry';
import { elementsOf, samplerValues, texturesOutcome, type TexturesOutcome } from './samplerValues';

/** What a slot reports for its texture: the texture once it loads, and whether more is on its way. */
export interface SlotState {
  readonly texture: THREE.Texture | null;
  /** False once the texture loads, or once nothing more arrives: a missing file or a CanvasTexture. */
  readonly isArriving: boolean;
  /** True when the texture never draws: its file, or a sheet it cuts from, cannot load. */
  readonly isMissing: boolean;
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

/** Each slot's state by its key, `name` or `name[index]`, and where the slots stand together. */
export interface SlotStates {
  readonly byKey: ReadonlyMap<string, SlotState>;
  readonly outcome: TexturesOutcome;
}

const NO_SLOT_STATES: SlotStates = { byKey: NO_STATES, outcome: 'settled' };

/** The loaded textures by uniform name, the slots the caller renders, and the slots' states. */
export function useShaderTextures(
  shader: ShaderTextures | null
): [Readonly<Record<string, SamplerValue>>, ReactNode, SlotStates] {
  const [states, setStates] = useState<ReadonlyMap<string, SlotState>>(NO_STATES);
  const report = useCallback<SlotReport>((key, state) => {
    setStates((current) => withEntry(current, key, state));
  }, []);
  const references = shader?.references ?? null;
  const textures = useMemo(
    () => (references ? samplerValues(references, loadedTextures(states)) : NO_TEXTURES),
    [references, states]
  );
  const mounted = useMemo(() => shader && mountedSlots(shader), [shader]);
  const slotStates = useMemo(
    () =>
      mounted
        ? {
            byKey: states,
            outcome: texturesOutcome(
              mounted.map(({ key }) => key),
              states
            ),
          }
        : NO_SLOT_STATES,
    [mounted, states]
  );
  if (!mounted) return [NO_TEXTURES, null, NO_SLOT_STATES];
  const slots = mounted.map(({ key, Slot, reference, isColor }) => (
    <Slot key={key} name={key} reference={reference} isColor={isColor} onState={report} />
  ));
  return [textures, slots, slotStates];
}

interface MountedSlot {
  readonly key: string;
  readonly Slot: ComponentType<ShaderTextureSlotProps>;
  readonly reference: ScopedReference;
  readonly isColor: boolean;
}

/** A slot for each texture a declared sampler reads: Godot ignores a value no sampler declares. */
function mountedSlots({ references, samplers }: ShaderTextures): MountedSlot[] {
  return Object.entries(references).flatMap(([name, reference]) => {
    const sampler = Object.hasOwn(samplers, name) ? samplers[name] : undefined;
    const Slot = sampler && SLOT_OF_KIND[sampler.kind];
    if (!Slot) return [];
    return elementsOf(name, reference).flatMap(([key, element]) =>
      element ? [{ key, Slot, reference: element, isColor: sampler.isColor }] : []
    );
  });
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
  const { texture, isArriving, missing, reportedSize } = useTexture2DRid(
    reference,
    isColor ? 'decoding' : 'plain'
  );
  const drawn = texture && topDownTexture(texture);
  const state = useMemo(
    () => ({ texture: drawn, isArriving, isMissing: missing, reportedSize }),
    [drawn, isArriving, missing, reportedSize]
  );
  useReportedState(name, state, onState);
  return null;
}

function CubemapSlot({ name, reference, onState }: ShaderTextureSlotProps): null {
  useReportedState(name, useCubemapState(reference), onState);
  return null;
}

function Texture3DSlot({ name, reference, onState }: ShaderTextureSlotProps): null {
  useReportedState(name, useTexture3DState(reference), onState);
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
