/**
 * The light side of a light kept apart: each frame, ahead of the draws, the pass asks a light's
 * placer where the light sits (`lightPassContext.ts`). The values sit in the canvas's world frame,
 * Godot's canvas flipped to y up, where a normal-mapped item shades.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { useEffect, useState } from 'react';
import type * as THREE from 'three';
import { normalizedVector2 } from '../../godot/math/vector.js';
import { useCanvasFrame } from '../canvasFrame.js';
import { useCanvasLighting2D } from './lightPassContext.js';

/**
 * Writes where a light sits into `place`, from its `origin` in the canvas whose `frame` is given,
 * and its `Light2D.height`.
 */
export type PlaceApartLight = (
  place: THREE.Vector3,
  origin: THREE.Object3D,
  height: number,
  frame: THREE.Object3D | null
) => void;

/**
 * The mean length of the frame's two axes, as Godot scales a positional light's height by the canvas
 * transform (`renderer_canvas_render_rd.cpp:612`). Positions in the world frame carry the same scale.
 */
function canvasFrameScale(frame: THREE.Object3D | null): number {
  if (!frame) return 1;
  frame.updateWorldMatrix(true, false);
  const e = frame.matrixWorld.elements;
  return (Math.hypot(e[0]!, e[1]!) + Math.hypot(e[4]!, e[5]!)) / 2;
}

/**
 * A positional light: its origin, not its texture's offset, and its height scaled by the canvas
 * transform into world units (`renderer_canvas_render_rd.cpp:612-620`).
 */
export const placePositionalLight: PlaceApartLight = (place, origin, height, frame) => {
  origin.updateWorldMatrix(true, false);
  place.setFromMatrixPosition(origin.matrixWorld).setZ(height * canvasFrameScale(frame));
};

/**
 * A directional light: the direction toward it is minus its normalised y axis
 * (`renderer_canvas_render_rd.cpp:542-545`). The world frame flips y, which negates that axis
 * again, so the direction is the world y axis itself. The height stays in 0 to 1 (`:549`).
 */
export const placeDirectionalLight: PlaceApartLight = (place, origin, height) => {
  origin.updateWorldMatrix(true, false);
  const elements = origin.matrixWorld.elements;
  const direction = normalizedVector2({ x: elements[4]!, y: elements[5]! });
  place.set(direction.x, direction.y, height);
};

/**
 * Hands the pass light `ordinal`'s placer, which reads the origin this returns a ref for, while the
 * light is declared and the origin mounted. `place` is a module function, so its identity holds.
 */
export function useApartLightOrigin(
  ordinal: number | null,
  place: PlaceApartLight,
  height: number
): (origin: THREE.Object3D | null) => void {
  const { registerApartPlacer } = useCanvasLighting2D();
  const frame = useCanvasFrame();
  const [origin, setOrigin] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    if (ordinal === null || !origin) return undefined;
    return registerApartPlacer(ordinal, (target) => place(target, origin, height, frame));
  }, [ordinal, origin, place, height, frame, registerApartPlacer]);
  return setOrigin;
}
