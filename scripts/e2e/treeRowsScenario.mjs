import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture } from './openFixture.mjs';
import { checkNodePaths, expandAllTreeRows, readOutlinerPaths, treeRow } from './outliner.mjs';

export const TREE_ROWS_FIXTURE = 'unit-tree-dock-rows.tscn';

// The rows Godot 4.6.3's Scene dock lists for the fixture, by get_owner and is_editable_instance (measured).
export const DOCK_ROWS = ['Main', 'Main/Plain', 'Main/Editable', 'Main/Editable/Inner', 'Main/Cube'];

// Godot's glTF importer roots the instance at a Node3D (measured), which the row's class badge names.
export const GLB_ROW = 'Main/Cube';
export const GLB_CLASS = 'Node3D';

// The glTF row appears once its file loads, so the read waits up to this long for it.
const ROWS_TIMEOUT_MS = 10_000;

/** Opens the fixture, expands every row, and reads the rows and the class badge of the glTF row. */
export async function runTreeRowsScenario(browser, baseUrl) {
  const { context, page, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: TREE_ROWS_FIXTURE,
    label: 'tree rows',
  });
  await treeRow(page, GLB_ROW)
    .waitFor({ timeout: ROWS_TIMEOUT_MS })
    .catch(() => {});
  await expandAllTreeRows(page);
  const rows = await readOutlinerPaths(page);
  const badge = await treeRow(page, GLB_ROW)
    .locator('[title]')
    .first()
    .getAttribute('title', { timeout: ROWS_TIMEOUT_MS })
    .catch(() => null);
  await context.close();
  return { rows, badge, diagnostics };
}

/** Records the scenario's claims on `gate`. */
export function checkTreeRows(gate, { rows, badge, diagnostics }) {
  checkDiagnostics(gate, '[tree rows]', diagnostics);
  checkNodePaths(gate, `[tree rows] ${TREE_ROWS_FIXTURE}`, DOCK_ROWS, rows);
  gate.check(
    badge === GLB_CLASS,
    `[tree rows] the ${GLB_ROW} row reads the class ${badge}, expected ${GLB_CLASS} as Godot's dock shows it`
  );
}
