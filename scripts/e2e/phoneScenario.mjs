/**
 * The phone scenario of the web-app E2E gate (ADR-0042). A portrait touch screen opens a 3D
 * fixture with no stored layout, and the gate reads the layout back from outside: the
 * viewport over a bottom sheet, one half of the sheet at a time, and no sideways scroll.
 */
import { findCanvas, gotoFixture, settleCanvas } from '../visual/previewServer.mjs';
import { attachDiagnostics, checkDiagnostics } from './diagnostics.mjs';
import {
  arraysEqual,
  describeNodePathMismatch,
  expandAllTreeRows,
  readOutlinerPaths,
  selectOutlinerNode,
} from './outliner.mjs';
import { readInspectorPanel } from './inspector.mjs';

/* global document */
// `document` exists only in the browser that runs the `page.evaluate` callbacks.

// A common phone in portrait, taller than the sheet's 501px floor and under its 768px width.
const PHONE_VIEWPORT = { width: 390, height: 844 };

const DOCK = 'section[aria-label="Scene and Inspector"]';

/** Whether the tree's root row can be seen, which it cannot while the Details half shows. */
function treeRowVisible(page) {
  return page.locator('[data-node-path="Root"]').first().isVisible();
}

/** Whether the inspector's node title can be seen, which it cannot while the Scene half shows. */
function inspectorVisible(page) {
  return page.locator(`${DOCK} h3`).first().isVisible();
}

export async function runPhoneScenario(browser, baseUrl, { fixture, selectPath }) {
  const context = await browser.newContext({ viewport: PHONE_VIEWPORT, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);

  await gotoFixture(page, baseUrl, fixture);
  const { canvas, reason: canvasReason } = await findCanvas(page);
  if (canvasReason) throw new Error(`[phone] ${canvasReason}`);
  await settleCanvas(page, canvas);

  // The layout viewport's width, not `innerWidth`: a mobile browser zooms out to fit wide
  // content, which widens `innerWidth` to match and hides the overflow this looks for.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const sourcePaneShown = (await page.locator('[data-testid="source-pane"]').count()) > 0;
  const helpBox = await page.getByLabel('Help and documentation').boundingBox();
  const canvasBox = await canvas.boundingBox();
  const dockBox = await page.locator(DOCK).boundingBox();

  await expandAllTreeRows(page);
  const paths = await readOutlinerPaths(page);
  const sceneHalf = { tree: await treeRowVisible(page), inspector: await inspectorVisible(page) };
  await selectOutlinerNode(page, selectPath);

  await page.getByRole('tab', { name: 'Details' }).tap();
  await page.locator(`${DOCK}[data-narrow-pane="details"]`).waitFor();
  const detailsHalf = { tree: await treeRowVisible(page), inspector: await inspectorVisible(page) };
  const inspector = await readInspectorPanel(page);

  await page.getByLabel('Collapse the scene panel').tap();
  await page.getByLabel('Show the side panel').waitFor();
  // The canvas follows its box a frame later. A timeout still measures: the check reports it.
  await page
    .waitForFunction(
      (before) => document.querySelector('canvas').getBoundingClientRect().height > before,
      canvasBox.height
    )
    .catch(() => {});
  const collapsedCanvasBox = await canvas.boundingBox();
  const collapsedBarBox = await page.getByLabel('Show the side panel').boundingBox();

  await page.getByLabel('Show the side panel').tap();
  await page.locator(DOCK).waitFor();
  const reopenedDockBox = await page.locator(DOCK).boundingBox();

  await context.close();

  return {
    overflow,
    sourcePaneShown,
    helpBox,
    canvasBox,
    dockBox,
    paths,
    sceneHalf,
    detailsHalf,
    inspector,
    collapsedCanvasBox,
    collapsedBarBox,
    reopenedDockBox,
    diagnostics,
  };
}

export function checkPhoneLayout(gate, phone, { expectedPaths, selectName }) {
  const label = '[phone]';
  gate.check(
    phone.overflow.scrollWidth <= phone.overflow.clientWidth,
    `${label} the page scrolls sideways: ${phone.overflow.scrollWidth}px of content in a ` +
      `${phone.overflow.clientWidth}px screen`
  );
  gate.check(
    !phone.sourcePaneShown,
    `${label} the Source pane is open on a first visit, covering the preview`
  );
  gate.check(
    !!phone.helpBox && phone.helpBox.x + phone.helpBox.width <= PHONE_VIEWPORT.width,
    `${label} the top bar pushes its help link off the screen (${JSON.stringify(phone.helpBox)})`
  );

  gate.check(!!phone.canvasBox && !!phone.dockBox, `${label} the canvas or the sheet has no layout box`);
  if (phone.canvasBox && phone.dockBox) {
    gate.check(
      phone.canvasBox.y + phone.canvasBox.height <= phone.dockBox.y + 1,
      `${label} the viewport does not sit over the sheet: canvas ${JSON.stringify(phone.canvasBox)}, ` +
        `sheet ${JSON.stringify(phone.dockBox)}`
    );
    gate.check(
      phone.canvasBox.height > phone.dockBox.height && phone.dockBox.width === PHONE_VIEWPORT.width,
      `${label} the sheet is not a full-width share under a taller viewport: canvas ` +
        `${phone.canvasBox.width}x${phone.canvasBox.height}, sheet ${phone.dockBox.width}x${phone.dockBox.height}`
    );
  }

  if (!arraysEqual(expectedPaths, phone.paths)) {
    const { missing, extra } = describeNodePathMismatch(expectedPaths, phone.paths);
    gate.check(
      false,
      `${label} the Scene half lists [${phone.paths.join(', ')}], expected [${expectedPaths.join(', ')}] ` +
        `(missing: [${missing.join(', ')}], extra: [${extra.join(', ')}])`
    );
  }
  gate.check(
    phone.sceneHalf.tree && !phone.sceneHalf.inspector,
    `${label} the Scene half shows tree=${phone.sceneHalf.tree} inspector=${phone.sceneHalf.inspector}, ` +
      'expected the tree alone'
  );
  gate.check(
    !phone.detailsHalf.tree && phone.detailsHalf.inspector,
    `${label} the Details half shows tree=${phone.detailsHalf.tree} inspector=${phone.detailsHalf.inspector}, ` +
      'expected the inspector alone'
  );
  gate.check(
    phone.inspector?.name === selectName,
    `${label} the Details half titles "${phone.inspector?.name}", expected "${selectName}"`
  );

  gate.check(
    !!phone.collapsedCanvasBox &&
      !!phone.canvasBox &&
      phone.collapsedCanvasBox.height > phone.canvasBox.height,
    `${label} collapsing the sheet does not grow the viewport ` +
      `(${phone.canvasBox?.height}px → ${phone.collapsedCanvasBox?.height}px)`
  );
  gate.check(
    !!phone.collapsedBarBox && phone.collapsedBarBox.width === PHONE_VIEWPORT.width,
    `${label} the collapsed sheet is not a full-width bar (${JSON.stringify(phone.collapsedBarBox)})`
  );
  gate.check(
    !!phone.reopenedDockBox && !!phone.dockBox && phone.reopenedDockBox.height === phone.dockBox.height,
    `${label} the reopened sheet is ${phone.reopenedDockBox?.height}px tall, was ${phone.dockBox?.height}px`
  );

  checkDiagnostics(gate, label, phone.diagnostics);
}
