import { PNG } from 'pngjs';
import { settleCanvas } from '../visual/previewServer.mjs';
import {
  checkNodePaths,
  expandAllTreeRows,
  readOutlinerPaths,
  readSelectedPaths,
  SELECT_SETTLE_MS,
} from './outliner.mjs';
import { openFixture } from './openFixture.mjs';
import { checkDiagnostics } from './diagnostics.mjs';

export const INSTANCE_CLICK_FIXTURE = 'unit-instanced-click.tscn';
// A hit walks up to a node the edited scene or an editable instance owns (node_3d_editor_plugin.cpp:807-815).
export const LOCKED_PICK = 'Root/Locked';
export const OPEN_PICK = 'Root/Open/Mesh';
// Godot 4.6.3's Scene dock lists the editable instance's mesh only (scene_tree_editor.cpp:283-290).
export const LISTED_ROWS = ['Root', 'Root/Locked', 'Root/Open', 'Root/Open/Mesh'];

const isRed = (r, g, b) => r > 200 && g < 60 && b < 60;

/**
 * Every red pixel as [x, y], and the span of their x.
 *
 * @param {Buffer} buffer PNG bytes
 */
export function redPixels(buffer) {
  const { data, width } = PNG.sync.read(buffer);
  const red = [];
  for (let i = 0; i < data.length; i += 4) {
    if (isRed(data[i], data[i + 1], data[i + 2])) red.push([(i / 4) % width, Math.floor(i / 4 / width)]);
  }
  // A reduce, not a spread: a box that fills the canvas holds more pixels than the call stack takes.
  const [minX, maxX] = red.reduce(
    ([lo, hi], [x]) => [Math.min(lo, x), Math.max(hi, x)],
    [Infinity, -Infinity]
  );
  return { red, minX, maxX };
}

/**
 * The centre of the red pixels on each side of the middle of their span, or null for no red pixel.
 *
 * @param {Buffer} buffer PNG bytes
 */
export function redBoxCentres(buffer) {
  const { red, minX, maxX } = redPixels(buffer);
  if (red.length === 0) return null;
  const middle = (minX + maxX) / 2;
  const right = centreOf(red.filter(([x]) => x >= middle));
  return { left: centreOf(red.filter(([x]) => x < middle)), right, rightEdge: rightEdgeOf(red, right) };
}

/** The last red pixel right of `centre` on its row, so a move right from it leaves the box. */
function rightEdgeOf(red, centre) {
  const row = red.filter(([x, y]) => y === centre.y && x >= centre.x).map(([x]) => x);
  return { x: Math.max(centre.x, ...row), y: centre.y };
}

function centreOf(points) {
  const sum = points.reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
  return { x: Math.round(sum[0] / points.length), y: Math.round(sum[1] / points.length) };
}

async function selectedAfterClickAt(page, canvas, position) {
  await canvas.click({ position });
  await page.waitForTimeout(SELECT_SETTLE_MS);
  return readSelectedPaths(page);
}

export async function runInstanceClickScenario(browser, baseUrl) {
  const { context, page, canvas, diagnostics } = await openFixture(browser, baseUrl, {
    fixture: INSTANCE_CLICK_FIXTURE,
    label: 'instance click',
  });
  await settleCanvas(page, canvas);
  await expandAllTreeRows(page);
  const rows = await readOutlinerPaths(page);
  const centres = redBoxCentres(await canvas.screenshot());
  const onLocked = centres ? await selectedAfterClickAt(page, canvas, centres.left) : null;
  const onOpen = centres ? await selectedAfterClickAt(page, canvas, centres.right) : null;
  await context.close();
  return { centres, rows, onLocked, onOpen, diagnostics };
}

export function checkInstanceClick(gate, { centres, rows, onLocked, onOpen, diagnostics }) {
  checkDiagnostics(gate, '[instance click]', diagnostics);
  checkNodePaths(gate, '[instance click] the scene tree', LISTED_ROWS, rows);
  gate.check(!!centres, '[instance click] the view draws no red box, so no click was made');
  if (!centres) return;
  gate.check(
    onLocked?.length === 1 && onLocked[0] === LOCKED_PICK,
    `[instance click] a click on the locked instance's mesh selects [${onLocked?.join(', ')}], ` +
      `expected [${LOCKED_PICK}]`
  );
  gate.check(
    onOpen?.length === 1 && onOpen[0] === OPEN_PICK,
    `[instance click] a click on the editable instance's mesh selects [${onOpen?.join(', ')}], ` +
      `expected [${OPEN_PICK}]`
  );
}

export const measureInstanceClick = ({ centres, onLocked, onOpen }) =>
  `instance click  boxes at ${JSON.stringify(centres)} | locked: [${onLocked?.join(', ')}] | ` +
  `editable: [${onOpen?.join(', ')}]`;
