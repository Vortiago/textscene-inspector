/**
 * The light side of the canvas template: each light hands its canvas a writer of its row of
 * `light_array`, which a lit template draw runs for the canvas layer it draws on.
 */

import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { mutableTransform2D } from '../../godot/math/transform2d.js';
import {
  directionalLightRow,
  pointLightRow,
  type CanvasLightRow,
  type Light2DValues,
} from '../../shaders/canvas/canvasLights.js';
import { decalAtlasRect, holdDecalTexture, releaseDecalTexture } from '../../nodes/3d/decal/decalAtlas.js';
import type { CanvasLightView } from '../canvasShader/canvasFrameLights.js';
import { onScreenInto } from '../canvasShader/canvasFrameLights.js';
import { canvasTransformInto } from '../node2dTransform.js';
import type { DirectionalLightTerm, LightTerm, PointLightTerm } from './CanvasLight2D.js';
import type { CanvasLightDeclaration } from './itemLightList.js';
import { useCanvasLighting2D } from './lightPassContext.js';

/** A light's row on the canvas `view` lights. */
export type LightRowWriter = (view: CanvasLightView) => CanvasLightRow;

/** What a canvas's template draws read of its lights. The pass owns it for the canvas's life. */
export interface CanvasLightRows {
  /** The declared lights by ordinal, which the pass replaces with each new state. */
  lights: ReadonlyMap<number, CanvasLightDeclaration>;
  /** Each light's writer by ordinal, while the light and its origin are mounted. */
  readonly writers: ReadonlyMap<number, LightRowWriter>;
}

/** Scratch of one row, overwritten by the next. */
const onScreen = mutableTransform2D();
const global = mutableTransform2D();

const NO_ATLAS_RECT = { x: 0, y: 0, w: 0, h: 0 };

function valuesOf({ color, energy, blendMode, height, shadow }: LightTerm): Light2DValues {
  return { color, energy, blendMode, height, shadowFilter: shadow.filter };
}

function pointRow(origin: THREE.Object3D, term: PointLightTerm, view: CanvasLightView): CanvasLightRow {
  const image = term.cookie.image as { width?: number; height?: number } | null | undefined;
  const rect = decalAtlasRect(term.cookie);
  return pointLightRow({
    ...valuesOf(term),
    global: canvasTransformInto(global, origin),
    onScreen: onScreenInto(onScreen, view, origin),
    canvasTransform: view.canvasTransform,
    textureSize: { width: image?.width ?? 1, height: image?.height ?? 1 },
    textureScale: term.textureScale,
    textureOffset: term.offset,
    atlasRect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : NO_ATLAS_RECT,
  });
}

function directionalRow(
  origin: THREE.Object3D,
  term: DirectionalLightTerm,
  view: CanvasLightView
): CanvasLightRow {
  return directionalLightRow({ ...valuesOf(term), onScreen: onScreenInto(onScreen, view, origin) });
}

function rowOf(origin: THREE.Object3D, term: LightTerm, view: CanvasLightView): CanvasLightRow {
  return term.kind === 'point' ? pointRow(origin, term, view) : directionalRow(origin, term, view);
}

/**
 * Hands the canvas light `ordinal`'s row writer while it is declared and the origin this returns a
 * ref for is mounted. A PointLight2D holds its texture in the light atlas meanwhile
 * (`texture_add_to_decal_atlas`, `renderer_canvas_cull.cpp:2134`).
 */
export function useLightRow(
  ordinal: number | null,
  term: LightTerm
): (origin: THREE.Object3D | null) => void {
  const { registerLightRow } = useCanvasLighting2D();
  const [origin, setOrigin] = useState<THREE.Object3D | null>(null);
  // A light builds its term each render: the writer reads the last one, so it registers once.
  const latest = useRef(term);
  latest.current = term;
  const cookie = term.kind === 'point' ? term.cookie : null;
  useEffect(() => {
    if (!cookie) return undefined;
    holdDecalTexture(cookie);
    return () => releaseDecalTexture(cookie);
  }, [cookie]);
  useEffect(() => {
    if (ordinal === null || !origin) return undefined;
    return registerLightRow(ordinal, (view) => rowOf(origin, latest.current, view));
  }, [ordinal, origin, registerLightRow]);
  return setOrigin;
}
