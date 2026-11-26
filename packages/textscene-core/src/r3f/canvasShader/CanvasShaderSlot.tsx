import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { canvasItemSamplerFilter, canvasItemSamplerRepeat } from '../../godot/scene/canvasItem';
import { TEXTURE_FILTER_WORDS } from '../../godot/rendering/materials/textureFilter';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { memoisedImport } from '../../resources/memoisedImport';
import type { CanvasTextureRepeat, CanvasTextureState } from '../../shaders/canvas/canvasTexture';
import { useCanvasColorSpace } from '../canvasColorSpace';
import type { CanvasItemTextureSampler } from '../canvasItemTextureSampler';
import { useCanvasModulate } from '../canvasModulate';
import { useRecordWriter } from '../components/Canvas2DStage/canvasFrameSequence';
import { useShaderTextures } from '../shaderTextures/shaderTextures';
import { useShaderRefusalWarning, useShaderTranslator } from '../shaderTranslator/useShaderTranslator';
import { sameCommandLayout, type CanvasShaderCommand } from './canvasCommands';
import { topDownTexture } from '../../resources/textures/topDownTexture';
import { useCanvasShaderMaps } from './useCanvasShaderMaps';
import type { CanvasItemTexture } from '../canvasItemTexture';

/** Imported by the first canvas_item shader only: it holds the shader parser and three's TSL. */
const loadCanvasShaderDraw = memoisedImport(() => import('./canvasShaderDraw'));

const LOAD_FAILURE =
  "[material] The previewer could not load its canvas shader translator, and draws Godot's default canvas shader. Reload to try again.";

/** What an item draws through a canvas_item shader: its commands, and the texture they share. */
export interface CanvasItemCommands {
  /** In draw order. */
  readonly commands: readonly CanvasShaderCommand[];
  /** The texture the commands draw, or null for Godot's white default texture. */
  readonly texture: THREE.Texture | null;
  /** The item's CanvasTexture, whose maps the shader reads, or undefined for a plain texture. */
  readonly canvasTexture: CanvasItemTexture | undefined;
  readonly sampler: CanvasItemTextureSampler;
}

interface CanvasShaderSlotProps extends CanvasItemCommands {
  shader: ShaderText;
  /** `Item::final_modulate`, in sRGB. */
  finalModulate: Rgba;
  /** The `renderOrder` of the first batch, which orders it inside the canvas item's group. */
  firstOrder: number;
  /** What the item draws while the translator loads, and for a shader it refuses. */
  fallback: ReactNode;
}

/** An item's own commands drawn through Godot's canvas template with a user's canvas_item shader. */
export function CanvasShaderSlot({
  shader,
  commands,
  texture,
  canvasTexture,
  sampler,
  finalModulate,
  firstOrder,
  fallback,
}: CanvasShaderSlotProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const translator = useShaderTranslator(loadCanvasShaderDraw, shader.code, LOAD_FAILURE);
  const module = translator?.module ?? null;
  const sampling = translator?.sampling;
  const usesLinearColors = useCanvasColorSpace().isLinear;
  const compiled = useMemo(
    () =>
      translator &&
      translator.module.canvasShaderOf(shader, {
        ...translator.options,
        sampling: translator.sampling,
        usesLinearColors,
      }),
    [translator, shader, usesLinearColors]
  );
  const shaded = compiled && 'item' in compiled ? compiled : null;
  const item = shaded?.item ?? null;
  useEffect(() => {
    if (!item) return;
    module!.warnOnTranslatorFault(shader, item);
    return () => module!.disposeCanvasShader(item);
  }, [module, shader, item]);
  useShaderRefusalWarning(shader, compiled && 'refusal' in compiled ? compiled.refusal : null);

  const canvasModulate = useCanvasModulate();
  const textureState = useMemo(
    () => canvasTextureState(sampler, usesLinearColors),
    [sampler, usesLinearColors]
  );
  const maps = useCanvasShaderMaps(canvasTexture);
  // A new frame of an animation keeps its draw: only a new layout builds new batches.
  const layout = useCommandLayout(commands);
  const draw = useMemo(
    () => item && sampling && module!.canvasShaderDraw(gl, item, { maps, textureState, sampling }, layout),
    [module, gl, item, maps, textureState, sampling, layout]
  );
  useEffect(() => (draw ? draw.dispose : undefined), [draw]);
  useLayoutEffect(() => {
    draw?.setFirstOrder(firstOrder);
    invalidate();
  }, [draw, firstOrder, invalidate]);
  const drawnTexture = texture && topDownTexture(texture);
  useLayoutEffect(() => {
    draw?.setSource(drawnTexture, commands);
    invalidate();
  }, [draw, drawnTexture, commands, invalidate]);
  useLayoutEffect(() => {
    draw?.setColors({ finalModulate, canvasModulate });
    invalidate();
  }, [draw, finalModulate, canvasModulate, invalidate]);
  useRecordWriter(draw?.writeRecords ?? null);

  const samplers = shaded?.samplers ?? null;
  const [textures, textureSlots] = useShaderTextures(
    useMemo(() => samplers && { references: shader.textures, samplers }, [samplers, shader.textures])
  );
  useLayoutEffect(() => {
    if (!item) return;
    module!.setMaterialParameters(item.parameters, shader.parameters, textures);
    invalidate();
  }, [module, item, shader.parameters, textures, invalidate]);

  if (!draw) return <>{fallback}</>;
  return (
    <>
      <primitive object={draw.object} />
      {textureSlots}
    </>
  );
}

/** The first of the command lists given since the layout last changed. */
function useCommandLayout(commands: readonly CanvasShaderCommand[]): readonly CanvasShaderCommand[] {
  const [layout, setLayout] = useState(commands);
  if (layout !== commands && !sameCommandLayout(layout, commands)) {
    setLayout(commands);
    return commands;
  }
  return layout;
}

/** The template's sampler state of the item's effective filter and repeat. */
function canvasTextureState(
  sampler: CanvasItemTextureSampler,
  usesLinearColors: boolean
): CanvasTextureState {
  return {
    filter: TEXTURE_FILTER_WORDS[canvasItemSamplerFilter(sampler.filter)],
    repeat: REPEAT_WORDS[canvasItemSamplerRepeat(sampler.repeat)],
    usesLinearColors,
  };
}

const REPEAT_WORDS: Readonly<Record<'clamp' | 'repeat' | 'mirror', CanvasTextureRepeat>> = {
  clamp: 'disabled',
  repeat: 'enabled',
  mirror: 'mirror',
};
