/**
 * VideoStreamPlayer registration: the native (WebGL canvas) painter, which draws nothing
 * (`Component.tsx`), and its minimum size from the stream's picture.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { VideoStreamPlayer } from './Component';
import { videoStreamPlayerMinimumSize, videoStreamPlayerTextureSlots } from './nativeSolver';

controlSolverRegistry.registerMinimumSize('VideoStreamPlayer', videoStreamPlayerMinimumSize);
controlSolverRegistry.registerTextureSlots('VideoStreamPlayer', videoStreamPlayerTextureSlots);

controlComponentRegistry.register({ typeName: 'VideoStreamPlayer', Component: VideoStreamPlayer });
