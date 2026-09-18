/**
 * The shot recipes behind `docs/user-guide-vscode.md`.
 *
 * Each key is the image the guide embeds; each `run` leaves the workbench in
 * the state that image's caption claims, and the caller shoots the window. The
 * recipes always start from `closeAllEditors`, because an editor left over from
 * the previous shot is what put an extra .tscn pane in every guide image.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { sleep } from './platform.mjs';
import { FIXTURES, WS } from './paths.mjs';
import {
  closeAllEditors,
  closeTab,
  expandAllTrees,
  frameShowing,
  openFile,
  openPreview,
  openScenePreview,
  palette,
  selectNode,
  setSideBar,
  settle,
  waitForCanvas,
} from './workbench.mjs';

/** Restore a scene in the throwaway workspace to the tracked fixture's bytes. */
function restore(file) {
  writeFileSync(`${WS}/${file}`, readFileSync(`${FIXTURES}/${file}`));
}

/**
 * Rewrite one scene in the throwaway workspace and let the preview catch up.
 *
 * The extension watches the file system, so writing the bytes is the same event
 * a human's Ctrl+S produces — and unlike typing into Monaco it cannot land the
 * edit in the wrong editor group.
 */
async function editScene(file, replace, withText) {
  const path = `${WS}/${file}`;
  const before = readFileSync(path, 'utf8');
  const after = before.replace(replace, withText);
  if (after === before) throw new Error(`edit did not apply to ${file}: ${replace}`);
  writeFileSync(path, after);
  await sleep(3500); // watcher → extension host → webview reparse
}

/**
 * Ctrl+click the first `res://` link in the focused editor.
 *
 * Monaco renders a document link as a `.detected-link` span only once the
 * pointer has been over its line, so the hover is part of the act, not a
 * flourish: without it the wait below times out on an editor that does in fact
 * offer the link.
 */
async function followResourceLink(page) {
  const line = page.locator('.view-line', { hasText: 'res://' }).first();
  await line.waitFor({ state: 'visible', timeout: 10000 });
  await line.hover();
  await sleep(800);
  const link = page.locator('.detected-link').first();
  await link.waitFor({ state: 'visible', timeout: 10000 });
  await link.click({ modifiers: ['Control'] });
  await sleep(1500);
}

/** Collapse the Explorer's Outline section again by clicking its header. */
async function collapseOutline(page) {
  await page.locator('.pane-header').filter({ hasText: 'Outline' }).first().click().catch(() => {});
  await sleep(600);
}

/** Put the caret on a line, so the shot shows where the reader is meant to be. */
async function gotoLine(page, line) {
  await page.keyboard.press('Control+g');
  await sleep(400);
  await page.keyboard.type(String(line), { delay: 12 });
  await page.keyboard.press('Enter');
  await sleep(600);
}

/**
 * Two previews side by side, one per scene, with no .tscn source left over.
 *
 * Built by opening each scene's preview in turn and closing only its own
 * source: "Close Editors in Other Groups" would take the first preview with it.
 */
async function twoPreviews(page, leftFile, rightFile) {
  restore(leftFile);
  restore(rightFile);
  // Two webviews plus the Explorer would put each below the shell's 768px
  // stacking width, and neither panel would show the tree the flow is about.
  await setSideBar(page, false);
  await closeAllEditors(page);
  for (const file of [leftFile, rightFile]) {
    await openFile(page, file);
    await openPreview(page);
    await sleep(1500);
    // Close the source by NAME, not by "the active editor": the preview it just
    // opened is what the workbench considers active, and closing that would
    // leave the .tscn text in the shot instead of the panel.
    await closeTab(page, file);
  }
  const painted = await waitForCanvas(page);
  await expandAllTrees(page);
  return painted;
}

/** A scene whose preview fills the editor area, nothing selected. */
const preview = (file) => async (page) => {
  restore(file); // an earlier shot may have edited it
  const painted = await openScenePreview(page, file);
  await settle();
  // The tree is the panel a reader is looking for, and a collapsed root shows
  // one row whatever the scene holds.
  await expandAllTrees(page);
  return painted;
};

/** A scene's preview beside its own .tscn source. */
const split = (file, { sideBar = true, previewShare = 0 } = {}) => async (page) => {
  restore(file);
  const painted = await openScenePreview(page, file, { split: true, sideBar, previewShare });
  await settle();
  await expandAllTrees(page);
  return painted;
};

export const GUIDE_SHOTS = {
  // VSCODE-01 — the preview opens beside the source, nothing selected yet.
  'vscode-01-a': { desc: 'preview opens beside the source file', run: split('unit-box-mesh.tscn', { sideBar: false, previewShare: 0.62 }) },

  // VSCODE-02 — hot reload. The pair must differ ONLY by the saved edit.
  'vscode-02-a': {
    desc: 'before edit — Box at origin',
    run: split('unit-box-mesh.tscn', { sideBar: false, previewShare: 0.62 }),
  },
  'vscode-02-b': {
    desc: 'after edit — Box translated, details panel shows Position X: 3.000',
    run: async (page) => {
      await editScene('unit-box-mesh.tscn', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)');
      await selectNode(await frameShowing(page, 'Box'), 'Root/Box');
      await settle(4000);
      return true;
    },
  },

  // VSCODE-03 — two panels, each with its own scene and its own selection.
  'vscode-03-a': {
    desc: 'two preview panels side-by-side, each showing a different fixture',
    run: async (page) => {
      const painted = await twoPreviews(page, 'unit-box-mesh.tscn', 'unit-sphere-mesh.tscn');
      await settle();
      return painted;
    },
  },
  'vscode-03-b': {
    desc: 'independent selection: Box in one panel, Sphere in the other',
    run: async (page) => {
      await selectNode(await frameShowing(page, 'Box'), 'Root/Box');
      await selectNode(await frameShowing(page, 'Sphere'), 'Root/Sphere');
      await settle(4000);
      return true;
    },
  },

  // VSCODE-04 — a res:// path is a document link, and following it opens the file.
  'vscode-04-a': {
    desc: 'unit-external-material.tscn with the caret on its res:// path',
    run: async (page) => {
      const painted = await openScenePreview(page, 'unit-external-material.tscn', { split: true });
      await settle();
      await palette(page, 'View: Focus First Editor Group');
      await gotoLine(page, 3);
      return painted;
    },
  },
  'vscode-04-b': {
    desc: 'after Ctrl+click — materials/metal.tres opens',
    run: async (page) => {
      await followResourceLink(page);
      await settle(3000);
      return true;
    },
  },

  // VSCODE-05 — the Outline view, not the preview, is the subject.
  'vscode-05-a': {
    desc: 'Outline lists the nested Level0 → Level1 → Level2 hierarchy',
    run: async (page) => {
      const painted = await openScenePreview(page, 'example-hierarchy-deep.tscn', { split: true });
      // The Outline answers for the ACTIVE editor, and opening the preview made
      // that the webview — which provides no symbols, so the view reports it
      // cannot. Put the .tscn back in front first.
      await palette(page, 'View: Focus First Editor Group');
      await palette(page, 'Outline: Focus on Outline View');
      await sleep(1200);
      await page.keyboard.press('ArrowDown'); // land on Level0; focusing the view focuses no row
      await sleep(400);
      // Two levels, so the row the walk ends on is Level2: the Outline section
      // shows about six rows, and a deeper walk scrolls Level0 off the top of
      // this 15-deep chain.
      for (let i = 0; i < 2; i++) {
        await page.keyboard.press('ArrowRight');
        await sleep(250);
        await page.keyboard.press('ArrowDown');
        await sleep(250);
      }
      await settle(3000);
      return painted;
    },
    // Every later shot would otherwise carry an expanded Outline reporting that
    // the preview provides no symbols.
    after: collapseOutline,
  },

  // VSCODE-06 — tree click populates the details panel.
  'vscode-06-a': {
    desc: 'CenterCube selected via tree click — details panel shows its properties',
    run: async (page) => {
      const painted = await openScenePreview(page, 'integration-three-cubes.tscn');
      await settle();
      await selectNode(await frameShowing(page, 'CenterCube'), 'ThreeCubes/CenterCube');
      return painted;
    },
  },

  // VSCODE-07 — the magenta placeholder for an unresolvable texture.
  'vscode-07-a': {
    desc: 'TestMesh renders as a magenta placeholder cube',
    run: preview('test-missing-texture.tscn'),
  },

  // VSCODE-08 — the panel survives a content-only save. Preview alone, so the
  // camera the flow is about is what fills the frame.
  'vscode-08-a': {
    desc: 'preview before a content edit',
    run: preview('unit-box-mesh.tscn'),
  },
  'vscode-08-b': {
    desc: 'after edit (transform X 0 → 1.5) — same panel instance, scene re-rendered',
    run: async () => {
      await editScene('unit-box-mesh.tscn', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1.5, 0, 0)');
      await settle(4000);
      return true;
    },
  },

  // BOTH-01 — the integration fixture's full child list.
  'both-01-a': {
    desc: 'integration-all-primitives scene tree expanded',
    run: preview('integration-all-primitives.tscn'),
  },

  // BOTH-02 — every MVS primitive in its own preview.
  'both-02-a': { desc: 'unit-box-mesh.tscn', run: preview('unit-box-mesh.tscn') },
  'both-02-b': { desc: 'unit-sphere-mesh.tscn', run: preview('unit-sphere-mesh.tscn') },
  'both-02-c': { desc: 'unit-plane-mesh.tscn', run: preview('unit-plane-mesh.tscn') },
  'both-02-d': { desc: 'unit-cylinder-mesh.tscn', run: preview('unit-cylinder-mesh.tscn') },
  'both-02-e': { desc: 'unit-capsule-mesh.tscn', run: preview('unit-capsule-mesh.tscn') },

  // BOTH-03 — lights, alone and mixed with geometry.
  'both-03-a': { desc: 'integration-lights-all-types.tscn', run: preview('integration-lights-all-types.tscn') },
  'both-03-b': { desc: 'integration-mixed-nodes.tscn', run: preview('integration-mixed-nodes.tscn') },

  // BOTH-04 — two WorldEnvironment configurations.
  'both-04-a': { desc: 'unit-world-environment-basic.tscn', run: preview('unit-world-environment-basic.tscn') },
  'both-04-b': { desc: 'unit-world-environment-no-fog.tscn', run: preview('unit-world-environment-no-fog.tscn') },
};

/**
 * Shots that continue the state the previous key left behind.
 *
 * A scene an edit shot rewrote is restored by the next recipe that OPENS it,
 * never by the shot that edited it: restoring first would let the watcher
 * revert the preview before the caller shoots. Keep that ordering in mind when
 * moving a key.
 *
 * A caller shooting a subset has to take the whole chain, or the follow-up
 * lands on whatever the last shot happened to leave open.
 */
export const SHOT_CHAINS = [
  ['vscode-02-a', 'vscode-02-b'],
  ['vscode-03-a', 'vscode-03-b'],
  ['vscode-04-a', 'vscode-04-b'],
  ['vscode-08-a', 'vscode-08-b'],
];
