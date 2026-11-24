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

// Godot 4.6.3 counts Menu and the Cube instance as the scene's own (measured), not the nodes of the .glb.
export const OWNED_NODES = '2 nodes';

const PRESSED_VIEW = '[aria-label="Viewport dimension"] [aria-pressed="true"]';

/** The view the toolbar shows pressed once it is `expected`, else the one pressed at the timeout. */
async function pressedView(page, expected) {
  const isPressed = ([selector, view]) => document.querySelector(selector)?.textContent === view;
  await page
    .waitForFunction(isPressed, [PRESSED_VIEW, expected], { timeout: PICK_TIMEOUT_MS })
    .catch(() => {});
  return page.evaluate((selector) => document.querySelector(selector)?.textContent ?? null, PRESSED_VIEW);
}

/** The node count chip once it reads the measured count, else what it reads at the timeout. */
async function countOnceSettled(page) {
  const chip = page.getByTestId('scene-info-nodes');
  await chip
    .filter({ hasText: OWNED_NODES })
    .waitFor({ timeout: PICK_TIMEOUT_MS })
    .catch(() => {});
  return chip.textContent();
}

/** Opens a Control root, then its instanced .glb on its own through the tree's ⤢ action. */
export async function runWorkspaceScenario(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: WORKSPACE_FIXTURE,
    label: 'workspace',
  });
  const controlRoot = await pressedView(page, '2D');
  const nodeCount = await countOnceSettled(page);
  await expandAllTreeRows(page);
  await treeRow(page, GLB_ROW).hover();
  await treeRow(page, GLB_ROW).getByRole('button', { name: 'Open sub-scene standalone' }).click();
  await page.waitForURL((url) => url.searchParams.get('fixture') === GLB_FIXTURE, { timeout: 10_000 });
  const glbRoot = await pressedView(page, '3D');
  await context.close();
  return { controlRoot, glbRoot, nodeCount, diagnostics };
}

/** Records the scenario's claims on `gate`. */
export function checkWorkspace(gate, { controlRoot, glbRoot, nodeCount, diagnostics }) {
  gate.check(controlRoot === '2D', `[workspace] a Control root: expected the 2D view, got ${controlRoot}`);
  gate.check(glbRoot === '3D', `[workspace] a .glb opened on its own: expected the 3D view, got ${glbRoot}`);
  gate.check(
    nodeCount === OWNED_NODES,
    `[workspace] the node count: expected ${OWNED_NODES}, got ${nodeCount}`
  );
  checkDiagnostics(gate, '[workspace]', diagnostics);
}
