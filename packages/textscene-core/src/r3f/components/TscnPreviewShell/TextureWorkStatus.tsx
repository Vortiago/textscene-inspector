import { StatusChip } from './StatusChip.js';
import { TEXTURE_WORK_STATUS_TESTID } from './statusTestIds.js';

// A capture harness waits for it to detach (ADR-0042).
export function TextureWorkStatus({ pendingTextures }: { pendingTextures: number }) {
  if (pendingTextures === 0) return null;
  return <StatusChip label="Building textures…" testId={TEXTURE_WORK_STATUS_TESTID} />;
}
