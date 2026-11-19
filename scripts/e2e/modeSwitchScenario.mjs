import { PNG } from 'pngjs';
import { diffMask } from '../vscode/pixels.mjs';
import { CANVAS_2D_TESTIDS } from '../visual/preview/appContract.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture, shootCanvas } from './openFixture.mjs';
import { expandAllTreeRows, selectOutlinerNode, SELECT_SETTLE_MS } from './outliner.mjs';

export const SWITCH_FIXTURE = 'in-game/unit-mode-switch.tscn';
const SELECTED_NODE = 'Main/Box';

/** The switches in order: away from 3D through each mode and back. */
export const SWITCHES = ['2D', 'In-game', '3D'];

// In-game draws through the scene camera, so its frame differs from the editor frame in thousands of px.
export const OTHER_VIEW_PIXELS = 1_000;
export const SAME_VIEW_PIXELS = 20;
// The ColorRect covers 240 by 180 px at zoom 1: the first 2D view, on a cold load, draws it.
export const PANEL_PIXELS = 20_000;

/** The pure red pixels of a shot: the fixture's ColorRect, which only a view that draws 2D shows. */
export function redPixels(buffer) {
  const { data } = PNG.sync.read(buffer);
  let red = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 230 && data[i + 1] < 30 && data[i + 2] < 30) red++;
  }
  return red;
}

const viewButton = (page, view) =>
  page.getByRole('group', { name: 'Viewport dimension' }).getByText(view, { exact: true });

const shoot = (page) => shootCanvas(page, 'Mode switch');

/** What the viewport holds in the mode the toolbar shows pressed. */
async function readView(page, view) {
  // The 2D stage loads on demand, so the read waits for it. A missing stage fails the claim, not this wait.
  if (view === '2D')
    await page
      .getByTestId(CANVAS_2D_TESTIDS.stage)
      .waitFor({ timeout: 10_000 })
      .catch(() => {});
  const shot = await shoot(page);
  return {
    view,
    isPressed: (await viewButton(page, view).getAttribute('aria-pressed')) === 'true',
    canvases: await page.locator('main[aria-label="Viewport"] canvas').count(),
    has2DStage: (await page.getByTestId(CANVAS_2D_TESTIDS.stage).count()) > 0,
    isSelected:
      (await page
        .locator(`[data-node-path="${SELECTED_NODE}"] > [role="treeitem"]`)
        .first()
        .getAttribute('aria-selected')) === 'true',
    shot,
  };
}

/** A view's facts, without the shot that only the pixel claims compare. */
function withoutShot(view) {
  const facts = { ...view };
  delete facts.shot;
  return facts;
}

/** Selects a node in 3D, then switches through each mode and back to 3D. */
export async function runModeSwitchScenario(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: SWITCH_FIXTURE,
    label: 'Mode switch',
  });
  await viewButton(page, '3D').click();
  await expandAllTreeRows(page);
  await selectOutlinerNode(page, SELECTED_NODE);
  await page.waitForTimeout(SELECT_SETTLE_MS);
  const views = [await readView(page, '3D')];
  for (const view of SWITCHES) {
    await viewButton(page, view).click();
    // A click shows the focus ring of the pressed view button, which the shot of the canvas holds.
    await page.evaluate(() => globalThis.document.activeElement?.blur());
    // The pointer rests off the toolbar, so no hovered button shows in the shot.
    await page.mouse.move(0, 0);
    views.push(await readView(page, view));
  }
  await context.close();
  const [first3D, twoD, inGame, last3D] = views;
  return {
    views: views.map(withoutShot),
    inGamePixels: diffMask(first3D.shot, inGame.shot).diffPixels,
    back3DPixels: diffMask(first3D.shot, last3D.shot).diffPixels,
    panelPixels2D: redPixels(twoD.shot),
    diagnostics,
  };
}

/** Records the scenario's claims on `gate`. */
export function checkModeSwitch(gate, { views, inGamePixels, back3DPixels, panelPixels2D, diagnostics }) {
  for (const view of views) {
    const at = `[Mode switch] ${view.view}`;
    gate.check(view.isPressed, `${at}: the toolbar does not show ${view.view} pressed`);
    gate.check(view.canvases === 1, `${at}: the viewport holds ${view.canvases} canvases, expected 1`);
    gate.check(
      view.has2DStage === (view.view === '2D'),
      `${at}: the 2D stage is ${view.has2DStage ? 'mounted' : 'absent'}, expected it only in 2D`
    );
    gate.check(view.isSelected, `${at}: ${SELECTED_NODE} lost its selection in the scene tree`);
  }
  gate.check(
    panelPixels2D > PANEL_PIXELS,
    `[Mode switch] the first 2D view drew ${panelPixels2D} px of the ColorRect, expected over ${PANEL_PIXELS}`
  );
  gate.check(
    inGamePixels > OTHER_VIEW_PIXELS,
    `[Mode switch] In-game differs from 3D in ${inGamePixels} px, expected over ${OTHER_VIEW_PIXELS}`
  );
  gate.check(
    back3DPixels < SAME_VIEW_PIXELS,
    `[Mode switch] back in 3D the view differs in ${back3DPixels} px, expected under ${SAME_VIEW_PIXELS}`
  );
  checkDiagnostics(gate, '[Mode switch]', diagnostics);
}
