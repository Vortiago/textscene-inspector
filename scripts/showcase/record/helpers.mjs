/**
 * The interaction primitives a showcase scenario receives as `helpers`.
 *
 * Each drives the REAL control a viewer would use — the command palette, a tree
 * row, an inspector button — so a clip demonstrates actual feature behavior.
 * The boolean-returning ones degrade instead of throwing: a missing or covered
 * control shortens the clip rather than failing the run.
 */

// Fail-fast actionability budget, applied context-wide in recordShowcase and
// reused by every explicit helper wait so the policy is tuned in one place.
export const ACTION_TIMEOUT_MS = 5000;

/** Best-effort click for the boolean helpers: false instead of a thrown timeout. */
async function tryClick(locator, timeout = ACTION_TIMEOUT_MS) {
  try {
    await locator.click({ timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Drag across the 3D canvas to orbit the camera. Middle button, because the
 * viewport navigates like Godot's editor: left-drag selects and never orbits.
 */
export async function orbit(page, { dx = 230, dy = 35, steps = 55 } = {}) {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'middle' });
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (dx * i) / steps, cy + Math.sin(i / 6) * dy);
    await page.waitForTimeout(25);
  }
  await page.mouse.up({ button: 'middle' });
}

/**
 * Switch scenes through the command-palette scene switcher (the native <select>
 * dropdown was retired for it): open the scene chip, filter by the fixture's
 * label, click the matching row, then settle. Exported for the standalone
 * verify harness (_verify.mjs).
 */
export async function selectScene(page, label) {
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  const search = page.getByLabel(/filter built-in scenes/i);
  await search.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
  await search.fill(label);
  await page.waitForTimeout(150); // filter settle
  // The palette's tree view has no Enter-to-select; click the matching row.
  await page.locator('[role="dialog"]').getByText(label, { exact: true }).first().click();
  await page.locator('[role="dialog"]').waitFor({ state: 'detached', timeout: ACTION_TIMEOUT_MS });
  await page.waitForTimeout(1300); // parse + resource load + CameraFit settle
}

/** Expand every collapsed tree row so deep nodes (cameras, etc.) are reachable. */
export async function expandTree(page) {
  for (let i = 0; i < 60; i++) {
    const collapsed = page.locator('[aria-label="Expand"]');
    if ((await collapsed.count()) === 0) break;
    if (!(await tryClick(collapsed.first()))) break;
    await page.waitForTimeout(120);
  }
}

/** Click a scene-tree row to select it. Target by node path, or by type badge. */
export async function clickNode(page, { path, type } = {}) {
  const sel = path
    ? `[data-node-path="${path}"]`
    : type
      ? `[data-node-path]:has(span[title="${type}"])`
      : '[data-node-path]';
  const row = page.locator(`${sel} >> [role="treeitem"]`).first();
  if ((await row.count()) === 0) return false;
  if (!(await tryClick(row))) return false;
  await page.waitForTimeout(400);
  return true;
}

/** Return the data-node-path of every Camera3D row in the tree (post-expand). */
export async function cameraNodePaths(page) {
  return page.locator('[data-node-path]:has(span[title="Camera3D"])').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-node-path')).filter(Boolean)
  );
}

/** Click the inspector "Use This Camera" button if the selected node is a Camera3D. */
export async function useThisCamera(page) {
  const btn = page.getByRole('button', { name: 'Use This Camera' });
  if ((await btn.count()) === 0) return false;
  if (!(await tryClick(btn.first()))) return false;
  await page.waitForTimeout(1300); // hold on this camera's POV
  return true;
}

/** Return to free-orbit (toolbar Reset Camera). */
export async function resetCamera(page) {
  const btn = page.getByRole('button', { name: /reset camera/i });
  if ((await btn.count()) === 0) return false;
  // Best-effort: the button can be covered by the top toolbar at narrow widths.
  if (!(await tryClick(btn.first()))) return false;
  await page.waitForTimeout(700);
  return true;
}

/** Type into the tree's node search box. */
export async function fillSearch(page, text) {
  const input = page.getByPlaceholder(/search nodes/i);
  if ((await input.count()) === 0) return false;
  await input.first().fill(text);
  await page.waitForTimeout(700);
  return true;
}

/** Open one of the detail-dock tabs (Inspector / Resources / Cameras). */
export async function openDetailTab(page, name) {
  for (const candidate of [page.getByRole('tab', { name }), page.getByText(name, { exact: true })]) {
    if ((await candidate.count()) && (await tryClick(candidate.first()))) {
      await page.waitForTimeout(300);
      return true;
    }
  }
  return false;
}

/**
 * Upload a local file for a specific missing-resource path via the
 * Resources-tab panel's per-row `<input type="file">`. Drives the
 * late-arrival pipeline (provideFile → useResource 'loaded' → re-render).
 */
export async function uploadResource(page, resPath, diskPath) {
  const input = page.locator(`div[data-path="${resPath}"] input[type="file"]`);
  await input.waitFor({ state: 'attached', timeout: ACTION_TIMEOUT_MS });
  await input.setInputFiles(diskPath);
  await page.waitForTimeout(900); // re-resolve + re-render settle
}
