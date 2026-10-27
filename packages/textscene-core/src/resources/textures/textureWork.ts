/**
 * How many procedural textures are still being built or uploaded, page-wide.
 * The preview shows a status while it is above zero, and a capture waits for
 * that status to clear, so a frame never settles on a texture still in flight.
 */
import { createWorkCount } from '../workCount';

export const textureWork = createWorkCount();
