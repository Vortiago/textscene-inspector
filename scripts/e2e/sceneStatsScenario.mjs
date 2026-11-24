import { checkDiagnostics } from './diagnostics.mjs';
import { openFixture } from './openFixture.mjs';

// Each count is Godot 4.6.3's: the root and each node it owns, measured on the fixture.
export const OWNED_COUNTS = [
  { fixture: 'unit-workspace-glb-instance.tscn', expected: '2 nodes', what: 'the nodes of a .glb instance' },
  {
    fixture: 'unit-scene-stats-chained-owners.tscn',
    expected: '2 nodes',
    what: 'an instance whose root inherits',
  },
];

// The count lands once the owner reads do, so a read waits up to this long for the measured count.
const COUNT_TIMEOUT_MS = 10_000;

/** The node count chip once it reads `expected`, else what it reads at the timeout. */
async function countOnceSettled(page, expected) {
  const chip = page.getByTestId('scene-info-nodes');
  await chip
    .filter({ hasText: expected })
    .waitFor({ timeout: COUNT_TIMEOUT_MS })
    .catch(() => {});
  return chip.textContent();
}

/** Opens each fixture and reads its node count chip. */
export async function runSceneStatsScenario(browser, baseUrl) {
  const counts = [];
  const diagnostics = [];
  for (const { fixture, expected } of OWNED_COUNTS) {
    const opened = await openFixture(browser, baseUrl, { fixture, label: 'scene stats' });
    counts.push(await countOnceSettled(opened.page, expected));
    diagnostics.push(opened.diagnostics);
    await opened.context.close();
  }
  return { counts, diagnostics };
}

/** Records the scenario's claims on `gate`. */
export function checkSceneStats(gate, { counts, diagnostics }) {
  OWNED_COUNTS.forEach(({ fixture, expected, what }, index) => {
    gate.check(
      counts[index] === expected,
      `[scene stats] ${what} (${fixture}): expected ${expected}, got ${counts[index]}`
    );
    checkDiagnostics(gate, `[scene stats] ${fixture}`, diagnostics[index]);
  });
}
