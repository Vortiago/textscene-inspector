/**
 * The light side of a light kept apart: each frame, ahead of the draws, a light writes where it
 * sits into the `ApartLight` the pass holds for its ordinal (`lightPassContext.ts`). The values sit
 * in the canvas's world frame, Godot's canvas flipped to y up, where a normal-mapped item shades.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { useEffect } from 'react';
import type * as THREE from 'three';
import { useCanvasFrame } from '../canvasFrame.js';
import { useCanvasLighting2D, type ApartLight } from './lightPassContext.js';

/** Writes what one light's origin, in the canvas whose `frame` is given, says about it into `light`. */
export type PlaceApartLight = (
  light: ApartLight,
  origin: THREE.Object3D,
  frame: THREE.Object3D | null
) => void;

/**
 * The mean length of the frame's two axes, as Godot scales a positional light's height by the canvas
 * transform (`renderer_canvas_render_rd.cpp:612`). Positions in the world frame carry the same scale.
 */
export function canvasFrameScale(frame: THREE.Object3D | null): number {
  if (!frame) return 1;
  frame.updateWorldMatrix(true, false);
  const e = frame.matrixWorld.elements;
  return (Math.hypot(e[0]!, e[1]!) + Math.hypot(e[4]!, e[5]!)) / 2;
}

/**
 * A positional light: its origin, not its texture's offset, and `height` in world units
 * (`renderer_canvas_render_rd.cpp:612-620`): the caller scales it with `canvasFrameScale`.
 */
export function placePositionalLight(
  light: ApartLight,
  origin: THREE.Object3D,
  height: number,
  mixes: boolean
): void {
  origin.updateWorldMatrix(true, false);
  light.place.setFromMatrixPosition(origin.matrixWorld).setZ(height);
  light.mode.set(0, mixes ? 1 : 0);
}

/**
 * A directional light: the direction toward it is minus its normalised y axis
 * (`renderer_canvas_render_rd.cpp:542-545`). The world frame flips y, which negates that axis
 * again, so the direction is the world y axis itself. The height stays in 0 to 1 (`:549`).
 */
export function placeDirectionalLight(
  light: ApartLight,
  origin: THREE.Object3D,
  height: number,
  mixes: boolean
): void {
  origin.updateWorldMatrix(true, false);
  const elements = origin.matrixWorld.elements;
  const yAxisX = elements[4]!;
  const yAxisY = elements[5]!;
  const length = Math.hypot(yAxisX, yAxisY);
  light.place.set(yAxisX / length, yAxisY / length, height);
  light.mode.set(1, mixes ? 1 : 0);
}

/**
 * Writes light `ordinal`'s place with `place` ahead of every pass, while the light is declared and
 * its origin mounted. `place` is memoised by the caller: a new function places again.
 */
export function usePlaceApartLight(
  ordinal: number | null,
  origin: THREE.Object3D | null,
  place: PlaceApartLight
): void {
  const { apartLight, registerPassStep } = useCanvasLighting2D();
  const frame = useCanvasFrame();
  useEffect(() => {
    if (ordinal === null || !origin) return undefined;
    const light = apartLight(ordinal);
    return registerPassStep(() => place(light, origin, frame));
  }, [ordinal, origin, frame, place, apartLight, registerPassStep]);
}
