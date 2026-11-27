import { useEffect, useRef } from 'react';
import type * as THREE from 'three';
import {
  multiplyTransform2DInto,
  mutableTransform2D,
  type MutableTransform2D,
  type Transform2DColumns,
} from '../../godot/math/transform2d.js';
import { ZERO_RECT } from '../../godot/math/rect2.js';
import {
  directionalLightRow,
  pointLightRow,
  type CanvasLightRow,
  type Light2DValues,
} from '../../shaders/canvas/canvasLights.js';
import { decalAtlasRect, holdDecalTexture, releaseDecalTexture } from '../../nodes/3d/decal/decalAtlas.js';
import { onScreenInto, type CanvasLightView } from '../canvasShader/canvasFrameLights.js';
import { canvasTransformInto } from '../node2dTransform.js';
import type { DirectionalLightTerm, LightTerm, PointLightTerm } from './CanvasLight2D.js';
import type { CanvasLightDeclaration } from './itemLightList.js';

/** What a canvas's template draws read of its lights. The pass owns it for the canvas's life. */
export interface CanvasLightRows {
  /** The declared lights by ordinal, which the pass replaces with each new state. */
  lights: ReadonlyMap<number, CanvasLightDeclaration>;
}

/** The values a row is built from, so an equal set reuses the row: 6 + 6 + 6 + 4 words. */
const KEY_WORDS = 22;

/** What a light hands the template draws: its row of `light_array` on a view. */
export interface LightRowSource {
  listedRow(view: CanvasLightView): CanvasLightRow | null;
}

// The light's component owns it: it sets the term each render, and the origin by ref.
/** A light's row built from its term, again only when the light, its canvas or the view moves. */
export class LightTermRow implements LightRowSource {
  /** Written by the light's component on each render. */
  term: LightTerm;
  /** Written only by `setOrigin`, the ref of the object at the light's node. */
  private origin: THREE.Object3D | null = null;
  private row: CanvasLightRow | null = null;
  private rowTerm: LightTerm | null = null;
  private readonly rowKey = new Float64Array(KEY_WORDS);
  private readonly key = new Float64Array(KEY_WORDS);
  private readonly onScreen = mutableTransform2D();
  private readonly global = mutableTransform2D();
  private readonly lightShape = mutableTransform2D();
  private readonly textureRect = mutableTransform2D();

  constructor(term: LightTerm) {
    this.term = term;
  }

  readonly setOrigin = (origin: THREE.Object3D | null): void => {
    this.origin = origin;
  };

  listedRow(view: CanvasLightView): CanvasLightRow | null {
    const { origin, term } = this;
    if (!origin) return null;
    onScreenInto(this.onScreen, view, origin);
    if (term.kind === 'point' && !this.meetsViewport(term, view)) return null;
    this.writeKey(origin, term, view);
    if (this.row && this.rowTerm === term && sameKey(this.key, this.rowKey)) return this.row;
    this.rowKey.set(this.key);
    this.rowTerm = term;
    return (this.row = term.kind === 'point' ? this.pointRow(term, view) : this.directionalRow(term));
  }

  /** `rect_cache`, the light's texture rect on screen, meets the viewport's rect. */
  private meetsViewport(term: PointLightTerm, view: CanvasLightView): boolean {
    multiplyTransform2DInto(this.lightShape, this.onScreen, textureRectInto(this.textureRect, term));
    const { a, b, c, d, tx, ty } = this.lightShape;
    // The parallelogram's bounds, met by `Rect2::intersects` against `clip_rect` at the origin.
    const x = tx + Math.min(0, a) + Math.min(0, c);
    const y = ty + Math.min(0, b) + Math.min(0, d);
    const { width, height } = view.viewport ?? view.size;
    return x < width && 0 < x + Math.abs(a) + Math.abs(c) && y < height && 0 < y + Math.abs(b) + Math.abs(d);
  }

  private writeKey(origin: THREE.Object3D, term: LightTerm, view: CanvasLightView): void {
    const global = term.kind === 'point' ? canvasTransformInto(this.global, origin) : this.global;
    const atlas = term.kind === 'point' ? (decalAtlasRect(term.cookie) ?? null) : null;
    writeTransform(this.key, 0, this.onScreen);
    writeTransform(this.key, 6, global);
    writeTransform(this.key, 12, view.canvasTransform);
    this.key[18] = atlas?.x ?? 0;
    this.key[19] = atlas?.y ?? 0;
    this.key[20] = atlas?.width ?? 0;
    this.key[21] = atlas?.height ?? 0;
  }

  private pointRow(term: PointLightTerm, view: CanvasLightView): CanvasLightRow {
    const image = term.cookie.image as { width?: number; height?: number } | null | undefined;
    const rect = decalAtlasRect(term.cookie);
    return pointLightRow({
      ...valuesOf(term),
      global: { ...this.global },
      onScreen: { ...this.onScreen },
      canvasTransform: view.canvasTransform,
      textureSize: { width: image?.width ?? 1, height: image?.height ?? 1 },
      textureScale: term.textureScale,
      textureOffset: term.offset,
      atlasRect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : ZERO_RECT,
    });
  }

  private directionalRow(term: DirectionalLightTerm): CanvasLightRow {
    return directionalLightRow({ ...valuesOf(term), onScreen: { ...this.onScreen } });
  }
}

function valuesOf({ color, energy, blendMode, height, shadow }: LightTerm): Light2DValues {
  return { color, energy, blendMode, height, shadowFilter: shadow.filter };
}

/** `Rect2(-tsize / 2 + texture_offset, tsize)` as the transform of the unit square onto it (`:452-476`). */
function textureRectInto(
  out: MutableTransform2D,
  { cookie, textureScale, offset }: PointLightTerm
): MutableTransform2D {
  const image = cookie.image as { width?: number; height?: number } | null | undefined;
  const width = (image?.width ?? 1) * textureScale;
  const height = (image?.height ?? 1) * textureScale;
  out.a = width;
  out.b = 0;
  out.c = 0;
  out.d = height;
  out.tx = -width / 2 + offset.x;
  out.ty = -height / 2 + offset.y;
  return out;
}

function writeTransform(key: Float64Array, at: number, { a, b, c, d, tx, ty }: Transform2DColumns): void {
  key[at] = a;
  key[at + 1] = b;
  key[at + 2] = c;
  key[at + 3] = d;
  key[at + 4] = tx;
  key[at + 5] = ty;
}

function sameKey(a: Float64Array, b: Float64Array): boolean {
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return false;
  return true;
}

// It holds a point light's texture in the light atlas while it lights (`renderer_canvas_cull.cpp:2134`).
/** The row source of a light whose term is `term`, the same object for the light's life. */
export function useLightRowSource(term: LightTerm): LightTermRow {
  const source = useRef<LightTermRow | null>(null);
  source.current ??= new LightTermRow(term);
  source.current.term = term;
  const cookie = term.kind === 'point' ? term.cookie : null;
  useEffect(() => {
    if (!cookie) return undefined;
    holdDecalTexture(cookie);
    return () => releaseDecalTexture(cookie);
  }, [cookie]);
  return source.current;
}
