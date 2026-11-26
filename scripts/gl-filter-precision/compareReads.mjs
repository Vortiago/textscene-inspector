import { compareImages } from '../visual/imageDelta.mjs';
import {
  createCaptureContext,
  openScene,
  previewPort,
  settleCanvas,
  withPreviewBrowser,
} from '../visual/previewServer.mjs';
import { applySceneWrites } from '../visual/sceneWrites.mjs';
import { parseSet } from '../godot-ref/run.mjs';
import { launchGodotComparisonBrowser, launchSwiftShaderBrowser } from '../showcase/browser.mjs';

/** A leftover of at most this many levels is residue, as `pnpm ref:diff` counts it. */
const RESIDUE_MAX_DELTA = 2;
/** SwiftShader filters both colours exactly, so each one-sample read draws the hand filter's picture. */
const ONE_SAMPLE_READS = ['sampled', 'float'];

/** `<fixture> [--lavapipe] [--set path:property=value]...`: lavapipe shows the check can fail. */
function parseArgs(argv) {
  const [fixture, ...rest] = argv;
  const hostCalls = [];
  let launchBrowser = launchSwiftShaderBrowser;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--lavapipe') launchBrowser = launchGodotComparisonBrowser;
    else if (rest[i] === '--set') hostCalls.push(parseSet(rest[++i]));
    else throw new Error(`expected --set or --lavapipe, got "${rest[i]}"`);
  }
  if (!fixture) throw new Error('expected a fixture name as in apps/textscene-web/src/fixtures.ts');
  return { fixture, hostCalls, launchBrowser };
}

async function capture(browser, baseUrl, { fixture, hostCalls }, storedDepthRead) {
  const context = await createCaptureContext(browser, {});
  const page = await context.newPage();
  const { target, reason } = await openScene(page, baseUrl, fixture, { storedDepthRead });
  if (!target) throw new Error(reason);
  await applySceneWrites(page, hostCalls);
  const { buffer, reason: settleReason } = await settleCanvas(page, target);
  if (!buffer) throw new Error(settleReason);
  await context.close();
  return buffer;
}

const args = parseArgs(process.argv.slice(2));
await withPreviewBrowser(
  { ...previewPort('perf'), launchBrowser: args.launchBrowser },
  async (browser, baseUrl) => {
    const fetched = await capture(browser, baseUrl, args, 'fetched');
    for (const read of ONE_SAMPLE_READS) {
      const buffer = await capture(browser, baseUrl, args, read);
      const { over, maxChannelDelta } = compareImages(buffer, fetched, { overDelta: RESIDUE_MAX_DELTA });
      console.log(`${read} against fetched: ${over.pixels} px over 2/255, max ${maxChannelDelta}/255`);
    }
  }
);
