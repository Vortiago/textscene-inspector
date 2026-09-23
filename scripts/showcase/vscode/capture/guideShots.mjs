/**
 * The shot recipes behind `docs/user-guide-vscode.md`. Each key is an image the guide embeds, and
 * each `run` leaves the workbench in the state its caption claims. A recipe starts from
 * `closeAllEditors`, since an editor left from the previous shot adds a .tscn pane to the image.
 */

import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

import { sleep } from './platform.mjs';
import { FIXTURES, WS } from './paths.mjs';
import {
  expandAllTrees,
  frameShowing,
  openScenePreview,
  palette,
  selectNode,
  settle,
  twoPreviews,
} from './workbench.mjs';

const BOX_SCENE = 'unit-box-mesh.tscn';
const BOX_IDENTITY = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)';

/** Restore a scene in the throwaway workspace to the tracked fixture's bytes. */
function restore(file) {
  copyFileSync(`${FIXTURES}/${file}`, `${WS}/${file}`);
}

/**
 * Rewrites one scene in the throwaway workspace and lets the preview catch up. The extension
 * watches the file system, so the write is the same event as a Ctrl+S, and unlike typing into
 * Monaco it cannot land in the wrong editor group.
 */
async function editScene(file, replace, withText) {
  const path = `${WS}/${file}`;
  const before = readFileSync(path, 'utf8');
  const after = before.replace(replace, withText);
  if (after === before) throw new Error(`edit did not apply to ${file}: ${replace}`);
  writeFileSync(path, after);
  await sleep(3500); // Watcher, extension host, then webview reparse.
}

/**
 * Ctrl+clicks the first `res://` link in the focused editor. Monaco renders a document link as a
 * `.detected-link` span only after the pointer has been over its line, so without the hover the
 * wait below times out.
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

/** Translate the Box fixture along X, the edit both hot-reload flows save. */
const moveBoxX = (x) =>
  editScene(BOX_SCENE, BOX_IDENTITY, `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${x}, 0, 0)`);

/**
 * A scene's preview, settled, with its tree expanded: the reader looks for the tree, and a
 * collapsed root shows one row whatever the scene holds.
 */
const scene = (file, opts) => async (page) => {
  restore(file); // An earlier shot may have edited it.
  const painted = await openScenePreview(page, file, opts);
  await settle();
  await expandAllTrees(page);
  return painted;
};

/** The Box beside its own .tscn source, wide enough for the desktop shell. */
const boxBesideSource = scene(BOX_SCENE, { split: true, sideBar: false, previewShare: 0.62 });

/** `both-*`: one fixture per shot, the filename its own caption. */
const SOLO_SHOTS = {
  'both-01-a': 'integration-all-primitives.tscn',
  'both-02-a': BOX_SCENE,
  'both-02-b': 'unit-sphere-mesh.tscn',
  'both-02-c': 'unit-plane-mesh.tscn',
  'both-02-d': 'unit-cylinder-mesh.tscn',
  'both-02-e': 'unit-capsule-mesh.tscn',
  'both-03-a': 'integration-lights-all-types.tscn',
  'both-03-b': 'integration-mixed-nodes.tscn',
  'both-04-a': 'unit-world-environment-basic.tscn',
  'both-04-b': 'unit-world-environment-no-fog.tscn',
};

export const GUIDE_SHOTS = {
  // VSCODE-01: the preview opens beside the source, with nothing selected.
  'vscode-01-a': { desc: 'preview opens beside the source file', run: boxBesideSource },

  // VSCODE-02: hot reload. The pair differs only by the saved edit.
  'vscode-02-a': { desc: 'before edit — Box at origin', run: boxBesideSource },
  'vscode-02-b': {
    desc: 'after edit — Box translated, details panel shows Position X: 3.000',
    continues: true,
    run: async (page) => {
      await moveBoxX(3);
      await selectNode(await frameShowing(page, 'Box'), 'Root/Box');
      await settle(4000);
      return true;
    },
  },

  // VSCODE-03: two panels, each with its own scene and its own selection.
  'vscode-03-a': {
    desc: 'two preview panels side-by-side, each showing a different fixture',
    run: async (page) => {
      restore(BOX_SCENE);
      restore('unit-sphere-mesh.tscn');
      const painted = await twoPreviews(page, BOX_SCENE, 'unit-sphere-mesh.tscn');
      await settle();
      return painted;
    },
  },
  'vscode-03-b': {
    desc: 'independent selection: Box in one panel, Sphere in the other',
    continues: true,
    run: async (page) => {
      await selectNode(await frameShowing(page, 'Box'), 'Root/Box');
      await selectNode(await frameShowing(page, 'Sphere'), 'Root/Sphere');
      await settle(4000);
      return true;
    },
  },

  // VSCODE-04: a res:// path is a document link, and following it opens the file.
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
    continues: true,
    run: async (page) => {
      await followResourceLink(page);
      await settle(3000);
      return true;
    },
  },

  // VSCODE-05: the Outline view, not the preview, is the subject.
  'vscode-05-a': {
    desc: 'Outline lists the nested Level0 → Level1 → Level2 hierarchy',
    run: async (page) => {
      const painted = await openScenePreview(page, 'example-hierarchy-deep.tscn', { split: true });
      // The Outline answers for the active editor, which is now the webview, and a webview
      // provides no symbols. So the .tscn comes back in front first.
      await palette(page, 'View: Focus First Editor Group');
      await palette(page, 'Outline: Focus on Outline View');
      await sleep(1200);
      await page.keyboard.press('ArrowDown'); // Lands on Level0: focusing the view focuses no row.
      await sleep(400);
      // Two levels, so the walk ends on Level2: the Outline shows about six rows, and a deeper
      // walk scrolls Level0 off the top of this 15-deep chain.
      for (let i = 0; i < 2; i++) {
        await page.keyboard.press('ArrowRight');
        await sleep(250);
        await page.keyboard.press('ArrowDown');
        await sleep(250);
      }
      await settle(3000);
      return painted;
    },
    // Otherwise every later shot carries an expanded Outline that says the preview has no symbols.
    after: collapseOutline,
  },

  // VSCODE-06: a tree click fills the details panel.
  'vscode-06-a': {
    desc: 'CenterCube selected via tree click — details panel shows its properties',
    run: async (page) => {
      const painted = await openScenePreview(page, 'integration-three-cubes.tscn');
      await settle();
      await selectNode(await frameShowing(page, 'CenterCube'), 'ThreeCubes/CenterCube');
      return painted;
    },
  },

  // VSCODE-07: the magenta placeholder for an unresolvable texture.
  'vscode-07-a': {
    desc: 'TestMesh renders as a magenta placeholder cube',
    run: scene('test-missing-texture.tscn'),
  },

  // VSCODE-08: the panel survives a content-only save. The preview is alone, so the camera the
  // flow is about fills the frame.
  'vscode-08-a': { desc: 'preview before a content edit', run: scene(BOX_SCENE) },
  'vscode-08-b': {
    desc: 'after edit (transform X 0 → 1.5) — same panel instance, scene re-rendered',
    continues: true,
    run: async () => {
      await moveBoxX(1.5);
      await settle(4000);
      return true;
    },
  },

  // BOTH-01..04: one fixture per shot, for primitives, lights and environments.
  ...Object.fromEntries(
    Object.entries(SOLO_SHOTS).map(([key, file]) => [key, { desc: file, run: scene(file) }])
  ),
};
