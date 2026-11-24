import { settleCanvas } from '../visual/previewServer.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { readInspectorPanel } from './inspector.mjs';
import { openFixture } from './openFixture.mjs';
import { expandAllTreeRows, selectOutlinerNode, SELECT_SETTLE_MS } from './outliner.mjs';

export const VIEW_STATUS_FIXTURE = 'unit-csg-mesh-open-brush.tscn';
const EMPTY_SHAPE = 'CsgMeshOpenBrushRoot/OpenQuad';
const DRAWN_SHAPE = 'CsgMeshOpenBrushRoot/ClosedBox';
const EMPTY_SHAPE_TITLE = 'Empty Shape';
const SOFTWARE_CHIP = 'software-rendering-status';

/** `softwareRenderer.ts`'s names of a renderer that rasterises on the CPU. */
const SOFTWARE_RENDERER =
  'SwiftShader|llvmpipe|softpipe|Microsoft Basic Render Driver|Apple Software Renderer';

/* global document */
// `document` exists only in the browser that runs the `page.evaluate` callback.

/** Whether the page's own WebGL draws in software, read as the view's probe reads it. */
function rendersInSoftware(page) {
  return page.evaluate((pattern) => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER);
    return new RegExp(pattern, 'i').test(String(name ?? ''));
  }, SOFTWARE_RENDERER);
}

/** The section titles the inspector shows for the node at `path`. */
async function sectionTitlesOf(page, path) {
  await selectOutlinerNode(page, path);
  await page.waitForTimeout(SELECT_SETTLE_MS);
  return (await readInspectorPanel(page))?.sections.map((section) => section.title) ?? [];
}

export async function runViewStatusScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: VIEW_STATUS_FIXTURE,
    label: 'view status',
  });
  await settleCanvas(page, canvas);
  await expandAllTreeRows(page);
  const emptyTitles = await sectionTitlesOf(page, EMPTY_SHAPE);
  const drawnTitles = await sectionTitlesOf(page, DRAWN_SHAPE);
  const isSoftware = await rendersInSoftware(page);
  const hasSoftwareChip = (await page.getByTestId(SOFTWARE_CHIP).count()) > 0;
  await context.close();
  return { emptyTitles, drawnTitles, isSoftware, hasSoftwareChip, diagnostics };
}

/** Records the scenario's claims on `gate`. */
export function checkViewStatus(
  gate,
  { emptyTitles, drawnTitles, isSoftware, hasSoftwareChip, diagnostics }
) {
  gate.check(
    emptyTitles.includes(EMPTY_SHAPE_TITLE),
    `[view status] ${EMPTY_SHAPE}: expected the "${EMPTY_SHAPE_TITLE}" note, got ${JSON.stringify(emptyTitles)}`
  );
  gate.check(
    !drawnTitles.includes(EMPTY_SHAPE_TITLE),
    `[view status] ${DRAWN_SHAPE}: expected no "${EMPTY_SHAPE_TITLE}" note, got ${JSON.stringify(drawnTitles)}`
  );
  gate.check(
    hasSoftwareChip === isSoftware,
    `[view status] software chip: expected ${isSoftware ? 'shown' : 'hidden'} for this browser's WebGL, got ${
      hasSoftwareChip ? 'shown' : 'hidden'
    }`
  );
  checkDiagnostics(gate, '[view status]', diagnostics);
}
