/**
 * ThorVG's `SvgLoader` as a picture's loader (`tvgSvgLoader.cpp:3913-4120`): the size and view box
 * its `svg` element sets, the scene its document builds, and the transform that draws the scene at
 * a picture's size.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { f32, FLOAT_EPSILON, matrix } from './math';
import { Scene, type ImageLoader, type Paint } from './paint';
import { readSvgBody, readSvgHeader, type SvgHeader } from './svgLoader';
import { SvgViewFlag } from './svgNode';
import { svgSceneBuild, type ImageOpener, type SceneView } from './svgSceneBuilder';

/** `SvgLoader::open`, `header` and `run`: the loader of `text`, or null where it holds no `svg` element. */
export function openSvgLoader(text: string, openImage: ImageOpener): ImageLoader | null {
  const header = readSvgHeader(text);
  if (!header) return null;
  const view = headerView(header.doc.node.doc);
  const root = hasEmptyViewBox(view) ? new Scene() : bodyScene(header, view, openImage);
  return svgImageLoader(root, view.w, view.h);
}

/** Whether the view box has no width or height, so the document draws nothing. */
function hasEmptyViewBox({ viewFlag, vBox }: SceneView): boolean {
  return (
    (viewFlag & SvgViewFlag.Viewbox) !== 0 &&
    (Math.abs(vBox.w) <= FLOAT_EPSILON || Math.abs(vBox.h) <= FLOAT_EPSILON)
  );
}

/** The scene of the document's body, or null where the body does not read. */
function bodyScene(header: SvgHeader, view: SceneView, openImage: ImageOpener): Paint | null {
  const body = readSvgBody(header);
  return body && svgSceneBuild(body.doc, view, openImage);
}

/** `SvgLoader::header`: the view box and size before the document is read, a missing one 1 or its percentage. */
function headerView(doc: {
  w: number;
  h: number;
  vx: number;
  vy: number;
  vw: number;
  vh: number;
  viewFlag: number;
  align: SceneView['align'];
  meetOrSlice: SceneView['meetOrSlice'];
}): SceneView {
  let viewFlag = doc.viewFlag;
  const { align, meetOrSlice } = doc;
  if (viewFlag & SvgViewFlag.Viewbox) {
    const side = (hasSide: number, inPercent: number, size: number, viewSize: number): number => {
      if (viewFlag & hasSide) return size;
      let value = viewSize;
      if (viewFlag & inPercent) {
        value = f32(value * size);
        viewFlag ^= inPercent;
      }
      viewFlag |= hasSide;
      return value;
    };
    const w = side(SvgViewFlag.Width, SvgViewFlag.WidthInPercent, doc.w, doc.vw);
    const h = side(SvgViewFlag.Height, SvgViewFlag.HeightInPercent, doc.h, doc.vh);
    return { vBox: { x: doc.vx, y: doc.vy, w: doc.vw, h: doc.vh }, w, h, align, meetOrSlice, viewFlag };
  }
  const hasWidth = (viewFlag & SvgViewFlag.Width) !== 0;
  const hasHeight = (viewFlag & SvgViewFlag.Height) !== 0;
  const w = hasWidth ? doc.w : viewFlag & SvgViewFlag.WidthInPercent ? doc.w : 1;
  const h = hasHeight ? doc.h : viewFlag & SvgViewFlag.HeightInPercent ? doc.h : 1;
  return {
    vBox: { x: 0, y: 0, w: hasWidth ? doc.w : 1, h: hasHeight ? doc.h : 1 },
    w,
    h,
    align,
    meetOrSlice,
    viewFlag,
  };
}

/** The loader a picture reads: its scene once, at the size the read set, and `resize` to draw it at another. */
function svgImageLoader(root: Paint | null, w: number, h: number): ImageLoader {
  let scene = root;
  return {
    w,
    h,
    paint() {
      const paint = scene;
      scene = null;
      return paint;
    },
    bitmap: () => null,
    resize(paint, width, height) {
      paint.transform(matrix(f32(width / w), 0, 0, 0, f32(height / h), 0, 0, 0, 1));
    },
  };
}
