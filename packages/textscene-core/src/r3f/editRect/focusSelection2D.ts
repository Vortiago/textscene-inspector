import type { Rect2 } from '../../godot/math/rect2.js';
import {
  transform2DFromParts,
  transform2DGetRotation,
  transform2DGetScale,
  transform2DOrigin,
  type Transform2DColumns,
} from '../../godot/math/transform2d.js';

/** Where the 2D stage looks: screen = pan + canvas pixel * zoom. */
export interface StageView {
  pan: { x: number; y: number };
  zoom: number;
}

interface StageSize {
  width: number;
  height: number;
}

/** canvas_item_editor_plugin.cpp:5216: Godot frames at 90 % of the tighter side. */
const FRAME_FILL = 0.9;

/** canvas_item_editor_plugin.cpp:5213, `CMP_EPSILON`. */
const MIN_FRAME_SIZE = 0.00001;

/** A rect's bounds after `transform` (transform_2d.h:229-240). */
function transformedRect(transform: Transform2DColumns, rect: Rect2): Rect2 {
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
  ].map(([x, y]) => ({
    x: transform.a * x! + transform.c * y! + transform.tx,
    y: transform.b * x! + transform.d * y! + transform.ty,
  }));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** canvas_item_editor_plugin.cpp:5168-5192. A null `editRect` frames the origin. */
export function selectionRect(global: Transform2DColumns, editRect: Rect2 | null): Rect2 {
  const origin = transform2DOrigin(global);
  const scale = transform2DGetScale(global);
  const turned = transformedRect(
    transform2DFromParts(transform2DGetRotation(global), { x: 1, y: 1 }, 0, { x: 0, y: 0 }),
    editRect ?? { x: 0, y: 0, w: 0, h: 0 }
  );
  return {
    x: origin.x + scale.x * turned.x,
    y: origin.y + scale.y * turned.y,
    w: scale.x * turned.w,
    h: scale.y * turned.h,
  };
}

/** `center_at` (canvas_item_editor_plugin.cpp:5561-5565): the view offset moves in whole canvas pixels. */
function centerAt(view: StageView, point: { x: number; y: number }, stage: StageSize): StageView {
  const { pan, zoom } = view;
  const offsetX = stage.width / 2 - (pan.x + point.x * zoom);
  const offsetY = stage.height / 2 - (pan.y + point.y * zoom);
  return {
    zoom,
    pan: { x: pan.x + Math.round(offsetX / zoom) * zoom, y: pan.y + Math.round(offsetY / zoom) * zoom },
  };
}

const centreOf = (rect: Rect2) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

/** `VIEW_FRAME_TO_SELECTION` (:5213-5223). The zoom holds to the stage's own range. */
export function frameSelection(
  view: StageView,
  rect: Rect2,
  stage: StageSize,
  minZoom: number,
  maxZoom: number
): StageView {
  if (rect.w <= MIN_FRAME_SIZE || rect.h <= MIN_FRAME_SIZE) return centerAt(view, centreOf(rect), stage);
  const fit = Math.min(stage.width / rect.w, stage.height / rect.h) * FRAME_FILL;
  const zoom = Math.max(minZoom, Math.min(maxZoom, fit));
  return centerAt({ pan: view.pan, zoom }, centreOf(rect), stage);
}

/** `VIEW_CENTER_TO_SELECTION` (:5225). */
export function centerSelection(view: StageView, rect: Rect2, stage: StageSize): StageView {
  return centerAt(view, centreOf(rect), stage);
}
