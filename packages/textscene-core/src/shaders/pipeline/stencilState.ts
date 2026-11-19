import * as THREE from 'three';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { StencilCompare, StencilFlag, WRITE_FLAGS } from '../../godot/rendering/materials/stencil.js';

/** A surface's stencil test: the flags of `StencilFlag`, the compare and the reference, 0 to 255. */
export interface StencilTest {
  readonly flags: number;
  readonly compare: EnumValue<typeof StencilCompare>;
  readonly reference: number;
}

/** The three state of a material's stencil, as `Material` names it. */
export type StencilState = Pick<
  THREE.Material,
  | 'stencilWrite'
  | 'stencilRef'
  | 'stencilFunc'
  | 'stencilFuncMask'
  | 'stencilWriteMask'
  | 'stencilFail'
  | 'stencilZFail'
  | 'stencilZPass'
>;

const STENCIL_FUNCS: Readonly<Record<EnumValue<typeof StencilCompare>, THREE.StencilFunc>> = {
  [StencilCompare.ALWAYS]: THREE.AlwaysStencilFunc,
  [StencilCompare.LESS]: THREE.LessStencilFunc,
  [StencilCompare.EQUAL]: THREE.EqualStencilFunc,
  [StencilCompare.LESS_OR_EQUAL]: THREE.LessEqualStencilFunc,
  [StencilCompare.GREATER]: THREE.GreaterStencilFunc,
  [StencilCompare.NOT_EQUAL]: THREE.NotEqualStencilFunc,
  [StencilCompare.GREATER_OR_EQUAL]: THREE.GreaterEqualStencilFunc,
};

const WHOLE_VALUE = 255;

/** A mask of 0 compares 0 and writes nothing (`scene_shader_forward_clustered.cpp:362`). */
function godotStencilState({ flags, compare, reference }: StencilTest): StencilState {
  const writes = (flag: number) => (flags & flag ? THREE.ReplaceStencilOp : THREE.KeepStencilOp);
  return {
    stencilWrite: true,
    stencilRef: reference,
    stencilFunc: STENCIL_FUNCS[compare],
    stencilFuncMask: flags & StencilFlag.READ ? WHOLE_VALUE : 0,
    stencilWriteMask: flags & WRITE_FLAGS ? WHOLE_VALUE : 0,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: writes(StencilFlag.WRITE_DEPTH_FAIL),
    stencilZPass: writes(StencilFlag.WRITE),
  };
}

/** Written only by `applyGodotStencil`. A material leaves it when it is disposed. */
const liveStencilMaterials = new Set<THREE.Material>();

/** Gives `material` Godot's stencil state, and counts it live until it is disposed. */
export function applyGodotStencil(material: THREE.Material, test: StencilTest): void {
  Object.assign(material, godotStencilState(test));
  if (liveStencilMaterials.has(material)) return;
  liveStencilMaterials.add(material);
  const leave = () => {
    liveStencilMaterials.delete(material);
    material.removeEventListener('dispose', leave);
  };
  material.addEventListener('dispose', leave);
}

/** A stencil attachment costs a 3D world about 13 % of its frame on software GL, so it waits for a user. */
export const isAnyStencilMaterialLive = (): boolean => liveStencilMaterials.size > 0;
