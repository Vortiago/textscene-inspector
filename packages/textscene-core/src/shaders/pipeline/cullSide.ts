import * as THREE from 'three';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { CullMode } from '../../godot/rendering/materials/cullMode.js';

/** three's `side` names the faces kept, where Godot's cull mode names the faces culled. */
export const CULL_SIDES: Readonly<Record<EnumValue<typeof CullMode>, THREE.Side>> = {
  [CullMode.BACK]: THREE.FrontSide,
  [CullMode.FRONT]: THREE.BackSide,
  [CullMode.DISABLED]: THREE.DoubleSide,
};
