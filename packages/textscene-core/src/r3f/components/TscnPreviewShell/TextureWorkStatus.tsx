/**
 * The top-bar status while procedural textures are still building or uploading.
 * A capture harness waits for it to detach (ADR-0042).
 */
import { usePendingTextureWork } from '../../../resources/usePendingTextureWork.js';
import { StatusChip } from './StatusChip.js';
import { TEXTURE_WORK_STATUS_TESTID } from './statusTestIds.js';

export function TextureWorkStatus() {
  if (usePendingTextureWork() === 0) return null;
  return <StatusChip label="Building textures…" testId={TEXTURE_WORK_STATUS_TESTID} />;
}
