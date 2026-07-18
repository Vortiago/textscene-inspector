#!/usr/bin/env node
// Deploy-time corpus vendor — never committed, but part of the DEPLOYED site.
/**
 * Vendor the ld-58 Godot project into scenes/ld58/ as an OPT-IN local corpus,
 * mirroring the scenes/games/ scheme (scripts/vendor-godot-games.mjs): the
 * source is fetched/copied locally, never committed (scenes/ld58/ is gitignored),
 * and `pnpm generate:fixtures` writes its manifest to the gitignored
 * apps/textscene-web/src/fixtures.ld58.ts that fixturesAll.ts merges at runtime.
 *
 * The ld-58 repo is PRIVATE, so most contributors won't have access — that is
 * expected and fine: the previewer builds and every committed fixture works
 * without it. The DEPLOYED site, however, does include this corpus (ADR-0010
 * amendment): `pnpm build:site` vendors it (script-stripped) alongside the
 * games corpora before the production web build, so deploys need access to
 * the private source; contributors without access simply deploy without it.
 *
 * Usage:
 *   pnpm vendor:ld58                       # fetch the default repo @ main
 *   pnpm vendor:ld58 --ref <branch|tag>    # fetch a specific ref
 *   pnpm vendor:ld58 --url <git-url>        # fetch a different remote
 *   pnpm vendor:ld58 --src /path/to/ld-58   # copy from a local checkout
 *
 * Re-runnable: wipes+recreates scenes/ld58/ each run, copies exactly the FILES
 * manifest below, and applies a DETERMINISTIC, mechanical script-strip to every
 * .tscn — we don't execute C#/GDScript and the .cs/.gd files aren't vendored, so
 * every `[ext_resource type="Script" …]` header and every `script = ExtResource(…)`
 * property line is removed and the header's `load_steps` is recomputed. All other
 * content (nodes, sub_resources, Texture2D/PackedScene ext_resources, res:// refs)
 * is preserved byte-faithfully. `pnpm vendor:ld58` chains `generate:fixtures`.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { fetchShallow } from './vendor-git.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(REPO_ROOT, 'scenes/ld58');
const DEFAULT_URL = 'https://github.com/Vortiago/ld-58.git';

/**
 * The exact source-relative paths to vendor (the res:// closure as curated at
 * the pre-strip commit). Kept verbatim so each scene's `res://…` references
 * resolve once mirrored under public/fixtures/. This is a deliberate whitelist
 * over a private repo — never derive it by walking the source, or newly added
 * private assets would be vendored silently. To re-list the original closure:
 *   git ls-tree -r --name-only d7cc1791 scenes/ld58 | sed 's|^scenes/ld58/||'
 */
const FILES = [
  'ClueContainer.tscn',
  'ClueItem.tscn',
  'HallwayGeometry.tscn',
  'Scenes/AboutDialog/AboutDialog.tscn',
  'Scenes/DialogSystem/DialogSystem.tscn',
  'Scenes/EndGameDialog/EndGameDialog.tscn',
  'Scenes/Evidence/DroppedLedger/DroppedLedger.glb',
  'Scenes/Evidence/DroppedLedger/DroppedLedger.tscn',
  'Scenes/Evidence/Handkerchief/Flowers1_N.jpg',
  'Scenes/Evidence/Handkerchief/Flowers1_S.jpg',
  'Scenes/Evidence/Handkerchief/Handkerchief.glb',
  'Scenes/Evidence/Handkerchief/Handkerchief.tscn',
  'Scenes/Evidence/Handkerchief/HandkerchiefModel.tscn',
  'Scenes/Evidence/LetterOpener/LetterOpener.tscn',
  'Scenes/Evidence/LetterOpener/royal-dagger.glb',
  'Scenes/GameUI/GameUI.tscn',
  'Scenes/Hallway/Hallway.tscn',
  'Scenes/PhotoFrame/Boat/Boat.tscn',
  'Scenes/PhotoFrame/Boat/boat.png',
  'Scenes/PhotoFrame/Books/Books.tscn',
  'Scenes/PhotoFrame/Books/books.png',
  'Scenes/PhotoFrame/Car/Car.tscn',
  'Scenes/PhotoFrame/Car/car.png',
  'Scenes/PhotoFrame/Cat/Cat.tscn',
  'Scenes/PhotoFrame/Cat/cat.png',
  'Scenes/PhotoFrame/Clock/Clock.tscn',
  'Scenes/PhotoFrame/Clock/clock.png',
  'Scenes/PhotoFrame/Dog/Dog.tscn',
  'Scenes/PhotoFrame/Dog/dog.png',
  'Scenes/PhotoFrame/DrHenryMorrison/DrHenryMorrison.png',
  'Scenes/PhotoFrame/DrHenryMorrison/DrHenryMorrison.tscn',
  'Scenes/PhotoFrame/EleanorHartwell/EleanorHeartwell.tscn',
  'Scenes/PhotoFrame/EleanorHartwell/Mrs. Eleanor Hartwell.png',
  'Scenes/PhotoFrame/Flowers/Flowers.tscn',
  'Scenes/PhotoFrame/Flowers/flowers.png',
  'Scenes/PhotoFrame/HouseKeeper/HouseKeeper.tscn',
  'Scenes/PhotoFrame/HouseKeeper/SarahMills.png',
  'Scenes/PhotoFrame/InspectorCrawford/InspectorCrawford.png',
  'Scenes/PhotoFrame/InspectorCrawford/InspectorCrawford.tscn',
  'Scenes/PhotoFrame/LadyBlackwood/Lady Margaret Blackwood.png',
  'Scenes/PhotoFrame/LadyBlackwood/LadyBlackwood.tscn',
  'Scenes/PhotoFrame/YoungTimBlackwood/Young Timothy Blackwood.png',
  'Scenes/PhotoFrame/YoungTimBlackwood/YoungTimBlackwood.tscn',
  'Scenes/StartScreen/StartScreen.tscn',
  'assets/PortraitFrame2.glb',
  'assets/doormesh.glb',
  'assets/doormesh.tscn',
  'assets/entrance_door_material.tres',
  'assets/grandfatherclock.glb',
  'assets/grandfatherclock.tscn',
  'assets/interior_door_material.tres',
  'assets/picture_frames_lib/picture_frame_victorian_1.glb',
  'assets/picture_frames_lib/picture_frame_victorian_2.glb',
  'assets/picture_frames_lib/picture_frame_victorian_3.glb',
  'assets/picture_frames_lib/picture_frame_victorian_5.glb',
  'assets/picture_frames_lib/textures/picture_frames_dif.png',
  'assets/picture_frames_lib/textures/picture_frames_nor.png',
  'assets/picture_frames_lib/victorian_1.tscn',
  'assets/picture_frames_lib/victorian_2.tscn',
  'assets/picture_frames_lib/victorian_3.tscn',
  'assets/picture_frames_lib/victorian_5.tscn',
  'assets/roof_lamp.glb',
  'assets/roof_lamp.png',
  'assets/roof_lamp.tscn',
  'assets/textures/WhiteRaised_N.jpg',
  'assets/textures/WhiteRaised_S.jpg',
  'assets/textures/fy_acc_lien.png',
  'assets/textures/g_toit-tower.png',
  'assets/textures/wood tex1.png',
  'assets/textures/wood tex2.png',
  'assets/textures/wood1.png',
  'components/CornerColumn.tscn',
  'components/Door.tscn',
  'components/EntranceDoor.tscn',
  'components/InteractableObject.tscn',
  'components/WallSection.tscn',
  'main.tscn',
  'shaders/pixel_perfect_ouline.tres',
  'shaders/pixel_perfect_outline.gdshader',
];

/**
 * Deterministic, mechanical script-strip for a single .tscn text. Removes every
 * `[ext_resource type="Script" …]` header and every `script = ExtResource(…)`
 * property line, then recomputes the header's `load_steps`
 * (= 1 + remaining ext_resources + sub_resources; Godot omits it when it is 1).
 * Everything else is preserved verbatim, so the transform is idempotent on an
 * already-stripped scene. Known limitation: the filter is line-based — a
 * multiline string VALUE whose continuation line happens to match these
 * patterns would be munged. No such content exists in the curated corpus.
 * @param {string} text
 * @returns {string}
 */
function stripScripts(text) {
  const lines = text.split('\n');
  const kept = lines.filter((line) => {
    if (/^\[ext_resource\b/.test(line) && line.includes('type="Script"')) return false;
    if (/^\s*script\s*=\s*ExtResource\(/.test(line)) return false;
    return true;
  });

  const extCount = kept.filter((line) => /^\[ext_resource\b/.test(line)).length;
  const subCount = kept.filter((line) => /^\[sub_resource\b/.test(line)).length;
  const loadSteps = 1 + extCount + subCount;

  const headerIdx = kept.findIndex((line) => /^\[gd_scene\b/.test(line));
  if (headerIdx !== -1) kept[headerIdx] = rewriteLoadSteps(kept[headerIdx], loadSteps);

  return kept.join('\n');
}

/**
 * Rewrite the `[gd_scene …]` header's `load_steps` to `steps`, matching Godot's
 * own output: present only when > 1, otherwise omitted entirely.
 * @param {string} header
 * @param {number} steps
 * @returns {string}
 */
function rewriteLoadSteps(header, steps) {
  const hasLoadSteps = /\bload_steps=\d+/.test(header);
  if (steps > 1) {
    return hasLoadSteps
      ? header.replace(/\bload_steps=\d+/, `load_steps=${steps}`)
      : header.replace(/^\[gd_scene\b/, `[gd_scene load_steps=${steps}`);
  }
  return hasLoadSteps ? header.replace(/\bload_steps=\d+\s*/, '') : header;
}

/** Parse `--flag value` out of argv (undefined if absent). */
function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main() {
  const argv = process.argv.slice(2);
  const srcArg = argValue(argv, '--src');
  const url = argValue(argv, '--url') ?? DEFAULT_URL;
  const ref = argValue(argv, '--ref') ?? 'main';

  let srcRoot;
  let work;
  try {
    if (srcArg) {
      srcRoot = resolve(srcArg);
      if (!existsSync(srcRoot)) {
        console.error(`[vendor-ld58] --src path not found: ${srcRoot}`);
        process.exitCode = 1;
        return;
      }
      console.log(`[vendor-ld58] copying from local checkout ${srcRoot}`);
    } else {
      work = mkdtempSync(join(tmpdir(), 'vendor-ld58-'));
      srcRoot = work;
      process.stdout.write(`[vendor-ld58] fetching ${url} @ ${ref} … `);
      fetchShallow(url, ref, srcRoot);
      console.log('done');
    }
  } catch {
    // Only source ACQUISITION gets the friendly no-stack message: the repo is
    // private, so a fetch failure for contributors without access is expected.
    console.error(
      `\n[vendor-ld58] Could not obtain the ld-58 source` +
        (srcArg ? ` from ${srcArg}.` : ` from ${url} (ref ${ref}).`) +
        `\n  ld-58 is vendored from a private repo — most contributors will NOT` +
        `\n  have access, and that's expected: the previewer builds and every` +
        `\n  committed fixture works without it. If you have a local checkout, run:` +
        `\n    pnpm vendor:ld58 --src /path/to/ld-58`
    );
    process.exitCode = 1;
    if (work) rmSync(work, { recursive: true, force: true });
    return;
  }

  // Past this point the source WAS obtained — a failure is a real bug and
  // must surface with its actual error, not the access message above.
  try {
    rmSync(TARGET, { recursive: true, force: true });
    mkdirSync(TARGET, { recursive: true });

    const missing = [];
    let copied = 0;
    let stripped = 0;
    for (const rel of FILES) {
      const from = join(srcRoot, rel);
      const to = join(TARGET, rel);
      if (!existsSync(from)) {
        missing.push(rel);
        continue;
      }
      mkdirSync(dirname(to), { recursive: true });
      if (rel.endsWith('.tscn')) {
        writeFileSync(to, stripScripts(readFileSync(from, 'utf8')));
        stripped++;
      } else {
        copyFileSync(from, to);
      }
      copied++;
    }

    console.log(`[vendor-ld58] vendored ${copied}/${FILES.length} files (${stripped} .tscn script-stripped) into scenes/ld58/`);
    if (missing.length) {
      console.warn(
        `[vendor-ld58] ${missing.length} manifest path(s) not found at the source ` +
          `(the repo may have drifted — update the FILES manifest):\n  - ${missing.join('\n  - ')}`
      );
    }
  } catch (err) {
    console.error('[vendor-ld58] vendoring failed after the source was obtained (scenes/ld58/ may be partial):', err);
    process.exitCode = 1;
  } finally {
    if (work) rmSync(work, { recursive: true, force: true });
  }
}

main();
