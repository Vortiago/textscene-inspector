/**
 * The clicks and keys a person uses in VS Code for the Web, for a gate that drives the
 * workbench page from outside. It reads only the workbench's own DOM, so no production
 * file carries a test hook.
 */
/* global document */
// `document` appears only inside `evaluate` callbacks, which run in the browser.
import { sleep } from './canvasReadback.mjs';

/** The workbench draws its first frame well inside this on a loaded runner. */
const WORKBENCH_TIMEOUT_MS = 60000;

/** A quick pick, an editor or an explorer row reacts well inside this. */
const UI_TIMEOUT_MS = 20000;

/** Waits for the workbench, then gives it keyboard focus, as a first click would. */
export async function waitForWorkbench(page) {
  await page.locator('.monaco-workbench .part.statusbar').waitFor({ timeout: WORKBENCH_TIMEOUT_MS });
  await page.locator('.monaco-workbench').focus();
}

/** Runs a command by its palette label, as a person does with F1. */
export async function runCommand(page, label) {
  await page.keyboard.press('F1');
  const input = page.locator('.quick-input-widget input');
  await input.waitFor({ timeout: UI_TIMEOUT_MS });
  await input.fill(`>${label}`);
  await page
    .locator('.quick-input-widget .monaco-list-row', { hasText: label })
    .first()
    .waitFor({ timeout: UI_TIMEOUT_MS });
  await page.keyboard.press('Enter');
}

/**
 * Answers "Yes" to the trust prompt a newly opened folder can raise. vscode.dev asks,
 * and the test server leaves workspace trust off, so a prompt that never comes is fine.
 */
export async function trustFolderIfAsked(page) {
  const yes = page.locator('.monaco-dialog-box').getByRole('button', { name: 'Yes', exact: true });
  await yes.click({ timeout: 5000 }).catch(() => {});
}

/** Opens a file from the Explorer with a click, which is how the editor gets focus. */
export async function openExplorerFile(page, name) {
  await page
    .locator('.explorer-folders-view')
    .getByText(name, { exact: true })
    .click({ timeout: UI_TIMEOUT_MS });
  await page.locator('.tabs-container .tab.active', { hasText: name }).waitFor({ timeout: UI_TIMEOUT_MS });
}

/** Clicks an action button in the title of the active editor, found by its tooltip. */
export async function clickEditorTitleAction(page, title) {
  await page.locator(`.editor-actions [aria-label*="${title}"]`).first().click({ timeout: UI_TIMEOUT_MS });
}

/**
 * The frame that holds the preview's document, which a webview nests inside VS Code's
 * own iframe. Null when no frame holds `#r3f-root` within `timeoutMs`.
 */
export async function findPreviewFrame(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const isPreview = await frame
        .evaluate(() => document.getElementById('r3f-root') !== null)
        .catch(() => false);
      if (isPreview) return frame;
    }
    await sleep(250);
  }
  return null;
}
