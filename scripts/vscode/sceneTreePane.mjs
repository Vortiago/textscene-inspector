/**
 * Reads the extension's Scene Tree view off the workbench, with the editor that is
 * active while it is read. VS Code's Outline is empty while a preview is the active
 * editor, so the gate reads this view in that state.
 */

/** How long VS Code may take to draw the view's rows after the header expands. */
const ROWS_TIMEOUT_MS = 15_000;

/**
 * @param {import('playwright').Page} page the workbench page
 * @returns {Promise<{ activeTab: string | null, header: boolean, rows: string[] }>}
 *   `rows` holds each row's node name, top to bottom. `header` is false when the view
 *   is not in the Explorer at all.
 */
export async function readSceneTreePane(page) {
  const activeTab = await activeEditorTab(page);
  const header = page.locator('.pane-header', { hasText: /^Scene Tree/ }).first();
  if ((await header.count()) === 0) return { activeTab, header: false, rows: [] };

  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  const rows = page.locator('.pane', { has: header }).locator('.monaco-list-row .label-name');
  await rows
    .first()
    .waitFor({ state: 'visible', timeout: ROWS_TIMEOUT_MS })
    .catch(() => {
      /* an empty view is the failure the gate reports */
    });
  return { activeTab, header: true, rows: await rows.allInnerTexts() };
}

/** The label of the active tab in the active editor group. */
async function activeEditorTab(page) {
  const tab = page.locator('.editor-group-container.active .tab.active').first();
  return (await tab.count()) === 0 ? null : tab.getAttribute('aria-label');
}
