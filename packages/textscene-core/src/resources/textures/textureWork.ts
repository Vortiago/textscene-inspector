/**
 * How many procedural textures are still being built or uploaded, page-wide.
 * The preview shows a status while it is above zero, and a capture waits for
 * that status to clear, so a frame never settles on a texture still in flight.
 */
import { useEffect } from 'react';
import { createWorkCount } from '../workCount';

export const textureWork = createWorkCount();

/**
 * Counts work while `isWorking`, so a build that stops in the commit showing it never reads zero.
 *
 * @canonical Texture work in flight
 */
export function useTextureWorkWhile(isWorking: boolean): void {
  useEffect(() => (isWorking ? textureWork.begin() : undefined), [isWorking]);
}
