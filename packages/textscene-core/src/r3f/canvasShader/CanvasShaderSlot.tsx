import { useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
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
import type { CanvasRectRegion } from './canvasCommands';
import { useCanvasShaderMaps } from './useCanvasShaderMaps';
import type { CanvasItemTexture } from '../canvasItemTexture';

/** Imported by the first canvas_item shader only: it holds the shader parser and three's TSL. */
const loadCanvasShaderDraw = memoisedImport(() => import('./canvasShaderDraw'));

const LOAD_FAILURE =
  "[material] The previewer could not load its canvas shader translator, and draws Godot's default canvas shader. Reload to try again.";

interface CanvasShaderSlotProps {
  shader: ShaderText;
  /** The rect the item draws its texture with. */
  region: CanvasRectRegion;
  texture: THREE.Texture;
  /** The item's CanvasTexture, whose maps the shader reads, or undefined for a plain texture. */
  canvasTexture: CanvasItemTexture | undefined;
  sampler: CanvasItemTextureSampler;
  /** `Item::final_modulate`, in sRGB. */
  finalModulate: Rgba;
  /** What the item draws while the translator loads, and for a shader it refuses. */
  fallback: ReactNode;
}

/** An item's own rect drawn through Godot's canvas template with a user's canvas_item shader. */
export function CanvasShaderSlot({
  shader,
  region,
  texture,
  canvasTexture,
  sampler,
  finalModulate,
  fallback,
}: CanvasShaderSlotProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const translator = useShaderTranslator(loadCanvasShaderDraw, shader, LOAD_FAILURE);
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
  const draw = useMemo(
    () => item && sampling && module!.rectShaderDraw(gl, item, { texture, maps, textureState, sampling }),
    [module, gl, item, texture, maps, textureState, sampling]
  );
  useEffect(() => (draw ? draw.dispose : undefined), [draw]);
  useLayoutEffect(() => {
    draw?.setRect({ region, finalModulate, canvasModulate });
    invalidate();
  }, [draw, region, finalModulate, canvasModulate, invalidate]);
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
