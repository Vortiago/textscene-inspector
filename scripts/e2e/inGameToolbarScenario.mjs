import { diffMask } from '../vscode/pixels.mjs';
import { findCanvas, settleCanvas } from '../visual/previewServer.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture } from './openFixture.mjs';
import { expandAllTreeRows, selectOutlinerNode, SELECT_SETTLE_MS } from './outliner.mjs';

/* global document */
// `document` exists only in the browser that runs the `page.evaluate` callback.

export const NOTES_FIXTURE = 'in-game/unit-in-game-notes.tscn';
export const CAMERA_FIXTURE = 'in-game/unit-in-game-call-camera3d.tscn';
const SELECTED_NODE = 'Main/Box';

export const EXPECTED_NOTES = [
  'Scripts do not run: 2 nodes hold a script.',
  'No Camera3D is current, so the 3D world does not draw.',
];

/** The toggles the running game overrides, in the menu's order. Only Performance stays live. */
export const NO_EFFECT_IN_GAME = [
  'Gizmos',
  'Collisions',
  'Labels',
  'Navigation',
  'Frame on open',
  'Grid',
  'Fog',
  'Preview Sun',
  'Preview Sky',
];

// The selection box of the 3D view covers thousands of pixels, and an unchanged view differs by none.
export const BOX_PIXELS = 100;
export const STILL_PIXELS = 20;

const viewButton = (page, view) =>
  page.getByRole('group', { name: 'Viewport dimension' }).getByText(view, { exact: true });

const readNotes = (page) => page.getByTestId('game-start-note').allTextContents();

async function shoot(page) {
  const { canvas, reason } = await findCanvas(page);
  if (reason) throw new Error(`[In-game toolbar] ${reason}`);
  const { buffer, reason: settleReason } = await settleCanvas(page, canvas);
  if (!buffer) throw new Error(`[In-game toolbar] the canvas never settled: ${settleReason}`);
  return buffer;
}

/** Each Display toggle by its label: checked and disabled. */
async function readToggles(page) {
  await page.getByTestId('display-menu-button').click();
  const toggles = await page
    .getByTestId('display-menu-popover')
    .locator('label')
    .evaluateAll((labels) =>
      labels.map((label) => {
        const box = label.querySelector('input');
        return { label: label.textContent, checked: box.checked, disabled: box.disabled };
      })
    );
  await page.getByTestId('display-menu-button').click();
  return toggles;
}

async function setGrid(page) {
  await page.getByTestId('display-menu-button').click();
  await page.getByTestId('display-toggle-Grid').check();
  await page.getByTestId('display-menu-button').click();
}

/** The notes In-game, and those the 3D and 2D views show of the same scene. */
async function runNotes(browser, baseUrl, fixture) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture,
    label: 'In-game notes',
  });
  const editorNotes = {};
  for (const view of ['3D', '2D']) {
    await viewButton(page, view).click();
    editorNotes[view] = await readNotes(page);
  }
  await viewButton(page, 'In-game').click();
  await shoot(page);
  const notes = await readNotes(page);
  await context.close();
  return { notes, editorNotes, diagnostics };
}

/** Grid on in 3D, then In-game, then 3D again. */
async function runToggles(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: CAMERA_FIXTURE,
    label: 'In-game toggles',
  });
  await viewButton(page, '3D').click();
  await setGrid(page);
  const before = await readToggles(page);
  await viewButton(page, 'In-game').click();
  const inGame = await readToggles(page);
  await viewButton(page, '3D').click();
  const backIn3D = await readToggles(page);
  await context.close();
  return { before, inGame, backIn3D, diagnostics };
}

const isRowSelected = (page, path) =>
  page.locator(`[data-node-path="${path}"] > [role="treeitem"]`).first().getAttribute('aria-selected');

/** How many pixels clearing the selection changes in `view`: a box in 3D, none In-game. */
async function selectionPixels(page, view) {
  await viewButton(page, view).click();
  const selected = await shoot(page);
  const isSelected = (await isRowSelected(page, SELECTED_NODE)) === 'true';
  await page.keyboard.press('Escape');
  // A key press shows the focus ring of the pressed view button, which the shot of the canvas holds.
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(SELECT_SETTLE_MS);
  const cleared = await shoot(page);
  return { isSelected, pixels: diffMask(selected, cleared).diffPixels };
}

async function selectBox(page) {
  await selectOutlinerNode(page, SELECTED_NODE);
  await page.waitForTimeout(SELECT_SETTLE_MS);
}

async function runSelection(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: CAMERA_FIXTURE,
    label: 'In-game selection',
  });
  await viewButton(page, '3D').click();
  await expandAllTreeRows(page);
  await selectBox(page);
  const threeD = await selectionPixels(page, '3D');
  await selectBox(page);
  const inGame = await selectionPixels(page, 'In-game');
  await context.close();
  return { threeD, inGame, diagnostics };
}

export async function runInGameToolbarScenario(browser, baseUrl) {
  return {
    notes: await runNotes(browser, baseUrl, NOTES_FIXTURE),
    noNotes: await runNotes(browser, baseUrl, CAMERA_FIXTURE),
    toggles: await runToggles(browser, baseUrl),
    selection: await runSelection(browser, baseUrl),
  };
}

function checkNotes(gate, { notes, noNotes }) {
  gate.check(
    JSON.stringify(notes.notes) === JSON.stringify(EXPECTED_NOTES),
    `[In-game notes] ${NOTES_FIXTURE} shows ${JSON.stringify(notes.notes)}, expected ${JSON.stringify(EXPECTED_NOTES)}`
  );
  for (const [view, shown] of Object.entries(notes.editorNotes)) {
    gate.check(
      shown.length === 0,
      `[In-game notes] the ${view} view of ${NOTES_FIXTURE} shows ${JSON.stringify(shown)}, expected no note`
    );
  }
  gate.check(
    noNotes.notes.length === 0,
    `[In-game notes] ${CAMERA_FIXTURE} shows ${JSON.stringify(noNotes.notes)}, expected no note`
  );
}

/** The labels whose checked state in `toggles` differs from that in `before`. */
const changedValues = (before, toggles) =>
  toggles
    .filter((toggle) => before.find((kept) => kept.label === toggle.label)?.checked !== toggle.checked)
    .map((toggle) => toggle.label);

function checkToggles(gate, { before, inGame, backIn3D }) {
  // Grid differs from its default, so a toggle reset by the switch shows as a change.
  const grid = before.find((toggle) => toggle.label === 'Grid');
  gate.check(grid?.checked === true, '[In-game toggles] Grid is off in 3D after the run set it on');
  for (const [where, toggles] of Object.entries({ 'In-game': inGame, 'back in 3D': backIn3D })) {
    const changed = changedValues(before, toggles);
    gate.check(
      changed.length === 0,
      `[In-game toggles] ${where}, ${JSON.stringify(changed)} changed value, expected each kept`
    );
  }
  const disabled = inGame.filter((toggle) => toggle.disabled).map((toggle) => toggle.label);
  gate.check(
    JSON.stringify(disabled) === JSON.stringify(NO_EFFECT_IN_GAME),
    `[In-game toggles] In-game disables ${JSON.stringify(disabled)}, expected ${JSON.stringify(NO_EFFECT_IN_GAME)}`
  );
  const liveIn3D = backIn3D.filter((toggle) => toggle.disabled).map((toggle) => toggle.label);
  gate.check(
    liveIn3D.length === 0,
    `[In-game toggles] back in 3D, ${JSON.stringify(liveIn3D)} stay disabled`
  );
}

function checkSelection(gate, { threeD, inGame }) {
  gate.check(
    threeD.pixels > BOX_PIXELS,
    `[In-game selection] the 3D box changed ${threeD.pixels} px, expected over ${BOX_PIXELS}, so the check sees a box`
  );
  gate.check(inGame.isSelected, `[In-game selection] ${SELECTED_NODE} is not selected in the tree In-game`);
  gate.check(
    inGame.pixels < STILL_PIXELS,
    `[In-game selection] the selection changed ${inGame.pixels} px In-game, expected under ${STILL_PIXELS}`
  );
}

/** Records the scenario's claims on `gate`. */
export function checkInGameToolbar(gate, result) {
  checkNotes(gate, result);
  checkToggles(gate, result.toggles);
  checkSelection(gate, result.selection);
  for (const [label, run] of Object.entries({
    notes: result.notes,
    'no notes': result.noNotes,
    toggles: result.toggles,
    selection: result.selection,
  })) {
    checkDiagnostics(gate, `[In-game ${label}]`, run.diagnostics);
  }
}
