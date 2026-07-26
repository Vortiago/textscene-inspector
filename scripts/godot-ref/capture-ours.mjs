#!/usr/bin/env node
/**
 * Our side of a parity measurement — the counterpart to `run.mjs`, which
 * renders the same scene through real Godot.
 *
 *   pnpm ref:ours unit-light-transport-direct.tscn --probe 320,200 --patch 5
 *   pnpm ref:ours unit-preview-lighting.tscn --out /tmp/ours.png
 *
 * Renders a fixture in the previewer under headless chromium (SwiftShader, the
 * same deterministic software rasterizer the visual gate uses) and prints the
 * colour at each probe in the same format `run.mjs` does, so the two outputs
 * sit side by side.
 *
 * The scene is addressed by its fixture FILENAME, exactly as
 * `apps/textscene-web/src/fixtures.ts` lists it — a fixture added to
 * `scenes/fixtures/` is unreachable here until `pnpm generate:fixtures` has
 * regenerated that catalog.
 *
 * Both sides open at Godot's editor camera by default (`godotEditorCamera.ts`
 * in the app, the same constants in `run.mjs`), so a bare `ref:godot` and a
 * bare `ref:ours` frame the same picture and a probe at (x, y) addresses the
 * same surface point on both. `--frame` switches both to the previewer's
 * fit-the-bounds mode for scenes too large to read at distance 4.
 *
 * `--2d` captures a 2D/Control scene the way `ref:godot` renders one: the
 * project viewport rectangle at zoom 1 with the stage's chrome painted out,
 * which `ref:godot` picks by itself from the scene root. Here it is a flag —
 * this harness renders whatever the app decided to show, and the flag says
 * which of the two frames to expect (a mismatch fails rather than silently
 * capturing the other one).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { probePixels } from './run.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  findCaptureTarget,
  gotoFixture,
  killPreviewGroup,
  settleCanvas,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';

// Distinct from the visual harness's 4317 so a capture and a golden run can
// share a host without either silently answering for the other.
const PORT = Number(process.env.PARITY_PORT) || 4319;

function parseArgs(argv) {
  const args = { fixture: null, out: null, probes: [], patch: 1, frame: false, canvas2D: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--out':
        args.out = argv[++i];
        break;
      case '--patch':
        args.patch = Number(argv[++i]);
        break;
      case '--frame':
        args.frame = true;
        break;
      case '--2d':
        args.canvas2D = true;
        break;
      case '--probe': {
        const raw = argv[++i];
        const parts = String(raw).split(',').map(Number);
        if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
          throw new Error(`--probe needs two comma-separated numbers, got "${raw}"`);
        }
        args.probes.push(parts);
        break;
      }
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag ${arg}`);
        args.fixture = arg;
    }
  }
  if (!args.fixture) throw new Error('a fixture filename is required');
  return args;
}

export async function captureOurs({ fixture, frame = false, canvas2D = false }) {
  ensureWebBuilt();
  await assertPortFree(PORT, 'PARITY_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    // Leave the app at Godot's fixed editor orbit (ADR-0025) — the same place
    // `ref:godot` puts its camera — so both sides frame identically with
    // nothing derived. `--frame` opts into the previewer's fit-the-bounds mode
    // for a scene too large to read at distance 4, and `ref:godot --frame`
    // mirrors it.
    const context = await createCaptureContext(browser, { frameOnOpen: frame, canvas2D });
    const page = await context.newPage();
    await gotoFixture(page, baseUrl, fixture, (ms) =>
      console.log(`[ours] no network idle within ${ms}ms`)
    );
    const { target, reason: targetReason } = await findCaptureTarget(page, { canvas2D });
    if (!target) throw new Error(targetReason);
    const { buffer, reason } = await settleCanvas(page, target);
    if (!buffer) throw new Error(reason);
    return buffer;
  } finally {
    await browser?.close();
    killPreviewGroup(proc);
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error('Usage: pnpm ref:ours <fixture.tscn> [--out file.png]');
    console.error('       [--probe x,y] [--patch n] [--frame] [--2d]');
    process.exit(2);
  }

  const buffer = await captureOurs(args);

  if (args.out) {
    const out = resolve(args.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buffer);
    console.log(`Rendered ${out}`);
  }

  for (const { x, y, rgb } of probePixels(buffer, args.probes, { patch: args.patch })) {
    console.log(`  probe ${x},${y} → rgb(${rgb.join(', ')})`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
