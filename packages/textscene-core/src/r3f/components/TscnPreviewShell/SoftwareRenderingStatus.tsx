import { StatusChip } from './StatusChip.js';

const SOFTWARE_RENDERING_STATUS_TESTID = 'software-rendering-status';

const ADVICE =
  'The browser draws WebGL on the CPU, not on a GPU, so scenes run slowly. Turn on graphics ' +
  'acceleration in its settings, then restart it.';

export function SoftwareRenderingStatus({ isSoftwareRendering }: { isSoftwareRendering: boolean }) {
  if (!isSoftwareRendering) return null;
  return <StatusChip label="Software WebGL" title={ADVICE} testId={SOFTWARE_RENDERING_STATUS_TESTID} />;
}
