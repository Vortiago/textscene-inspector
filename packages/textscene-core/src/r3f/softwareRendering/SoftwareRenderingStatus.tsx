/**
 * The top-bar status while the browser draws WebGL in software. Every scene then runs at a few
 * frames a second, so the viewer names the cause where the user looks first.
 */

import { StatusChip } from '../components/TscnPreviewShell/StatusChip.js';
import { useRendersInSoftware } from './SoftwareRenderingContext.js';

const SOFTWARE_RENDERING_STATUS_TESTID = 'software-rendering-status';

const ADVICE =
  'The browser draws WebGL on the CPU, not on a GPU, so scenes run slowly. Turn on graphics ' +
  'acceleration in its settings, then restart it.';

export function SoftwareRenderingStatus() {
  if (!useRendersInSoftware()) return null;
  return <StatusChip label="Software WebGL" title={ADVICE} testId={SOFTWARE_RENDERING_STATUS_TESTID} />;
}
