import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture } from './openFixture.mjs';
import { expandAllTreeRows, treeRow } from './outliner.mjs';

export const WORKSPACE_FIXTURE = 'unit-workspace-glb-instance.tscn';
const GLB_ROW = 'Menu/Cube';
// The ⤢ action opens the sub-scene as the fixture at its path, so the URL names the .glb.
const GLB_FIXTURE = 'meshes/unit-cube.glb';

// The root's class picks the view once its reads land, so a read waits up to this long for it.
const PICK_TIMEOUT_MS = 10_000;

/* global document */ // `document` exists only in the browser that runs the callback.

const PRESSED_VIEW = '[aria-label="Viewport dimension"] [aria-pressed="true"]';

/** The view the toolbar shows pressed once it is `expected`, else the one pressed at the timeout. */
async function pressedView(page, expected) {
  const isPressed = ([selector, view]) => document.querySelector(selector)?.textContent === view;
  await page
    .waitForFunction(isPressed, [PRESSED_VIEW, expected], { timeout: PICK_TIMEOUT_MS })
    .catch(() => {});
  return page.evaluate((selector) => document.querySelector(selector)?.textContent ?? null, PRESSED_VIEW);
}

/** Opens a Control root, then its instanced .glb on its own through the tree's ⤢ action. */
export async function runWorkspaceScenario(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: WORKSPACE_FIXTURE,
    label: 'workspace',
  });
  const controlRoot = await pressedView(page, '2D');
  await expandAllTreeRows(page);
  await treeRow(page, GLB_ROW).hover();
  await treeRow(page, GLB_ROW).getByRole('button', { name: 'Open sub-scene standalone' }).click();
  await page.waitForURL((url) => url.searchParams.get('fixture') === GLB_FIXTURE, { timeout: 10_000 });
  const glbRoot = await pressedView(page, '3D');
  await context.close();
  return { controlRoot, glbRoot, diagnostics };
}

/** Records the scenario's claims on `gate`. */
export function checkWorkspace(gate, { controlRoot, glbRoot, diagnostics }) {
  gate.check(controlRoot === '2D', `[workspace] a Control root: expected the 2D view, got ${controlRoot}`);
  gate.check(glbRoot === '3D', `[workspace] a .glb opened on its own: expected the 3D view, got ${glbRoot}`);
  checkDiagnostics(gate, '[workspace]', diagnostics);
}
