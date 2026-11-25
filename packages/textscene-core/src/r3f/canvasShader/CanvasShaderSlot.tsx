import { useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { canvasItemSamplerFilter, canvasItemSamplerRepeat } from '../../godot/scene/canvasItem';
import type { EnumValue } from '../../godot/classdb/enumNames';
import { TextureFilter } from '../../godot/rendering/materials/textureFilter';
import { projectSampling } from '../../parser/projectSettingsParser';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { memoisedImport } from '../../resources/memoisedImport';
import { useLazyModuleState } from '../../resources/useLazyModule';
import type { CanvasTextureFilter, CanvasTextureRepeat, CanvasTextureState } from '../../shaders/canvas/canvasTexture';
import { warnOnce } from '../../utils/warnOnce';
import { useNodesHandler } from '../canvasRenderer/canvasNodesHandler';
import { useCanvasColorSpace } from '../canvasColorSpace';
import type { CanvasItemTextureSampler } from '../canvasItemTextureSampler';
import { useCanvasModulate } from '../canvasModulate';
import { useRecordWriter } from '../components/Canvas2DStage/canvasFrameSequence';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { useProjectShaderOptions } from '../projectShaderOptions';
import { useShaderTextures } from '../shaderTextures/shaderTextures';
import type { CanvasRectRegion } from './canvasCommands';

/** Imported by the first canvas_item shader only: it holds the shader parser and three's TSL. */
const loadCanvasShaderDraw = memoisedImport(() => import('./canvasShaderDraw'));

const LOAD_FAILURE =
  "[material] The previewer could not load its canvas shader translator, and draws Godot's default canvas shader. Reload to try again.";

interface CanvasShaderSlotProps {
  shader: ShaderText;
  /** The rect the item draws its texture with. */
  region: CanvasRectRegion;
  texture: THREE.Texture;
  sampler: CanvasItemTextureSampler;
  /** `Item::final_modulate`, in sRGB. */
  finalModulate: Rgba;
  /** What the item draws while the translator loads, and for a shader it refuses. */
  fallback: ReactNode;
}

/** An item's own rect drawn through Godot's canvas template with a user's canvas_item shader. */
export function CanvasShaderSlot({ shader, region, texture, sampler, finalModulate, fallback }: CanvasShaderSlotProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const loaded = useLazyModuleState(loadCanvasShaderDraw, true);
  const module = typeof loaded === 'object' && loaded !== null ? loaded.module : null;
  const nodesHandler = useNodesHandler(gl);
  const options = useProjectShaderOptions(shader.code);
  const { settings } = useProjectSettings();
  const sampling = useMemo(() => projectSampling(settings), [settings]);
  const usesLinearColors = useCanvasColorSpace().isLinear;
  const isReady = module !== null && options !== null && nodesHandler === 'ready';
  const compiled = useMemo(
    () => (isReady ? module.canvasShaderOf(shader, { ...options, sampling, usesLinearColors }) : null),
    [isReady, module, shader, options, sampling, usesLinearColors]
  );
  const shaded = compiled && 'item' in compiled ? compiled : null;
  const item = shaded?.item ?? null;
  useEffect(() => {
    if (!item) return;
    module!.warnOnTranslatorFault(shader, item);
    return () => module!.disposeCanvasShader(item);
  }, [module, shader, item]);

  const refusal = compiled && 'refusal' in compiled ? compiled.refusal : null;
  const isLoadFailed = loaded === 'failed' || nodesHandler === 'failed';
  useEffect(() => {
    if (refusal) warnOnce(shader, 'refused', refusal);
    else if (isLoadFailed) warnOnce(loadCanvasShaderDraw, 'failed', LOAD_FAILURE);
  }, [shader, refusal, isLoadFailed]);

  const canvasModulate = useCanvasModulate();
  const textureState = useMemo(() => canvasTextureState(sampler, usesLinearColors), [sampler, usesLinearColors]);
  const draw = useMemo(
    () => item && module!.rectShaderDraw(gl, item, { texture, textureState, sampling }),
    [module, gl, item, texture, textureState, sampling]
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
function canvasTextureState(sampler: CanvasItemTextureSampler, usesLinearColors: boolean): CanvasTextureState {
  return {
    filter: FILTER_WORDS[canvasItemSamplerFilter(sampler.filter)],
    repeat: REPEAT_WORDS[canvasItemSamplerRepeat(sampler.repeat)],
    usesLinearColors,
  };
}

const REPEAT_WORDS: Readonly<Record<'clamp' | 'repeat' | 'mirror', CanvasTextureRepeat>> = {
  clamp: 'disabled',
  repeat: 'enabled',
  mirror: 'mirror',
};

const FILTER_WORDS: Readonly<Record<EnumValue<typeof TextureFilter>, CanvasTextureFilter>> = {
  [TextureFilter.NEAREST]: 'nearest',
  [TextureFilter.LINEAR]: 'linear',
  [TextureFilter.NEAREST_WITH_MIPMAPS]: 'nearest_mipmap',
  [TextureFilter.LINEAR_WITH_MIPMAPS]: 'linear_mipmap',
  [TextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC]: 'nearest_mipmap_anisotropic',
  [TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC]: 'linear_mipmap_anisotropic',
};
