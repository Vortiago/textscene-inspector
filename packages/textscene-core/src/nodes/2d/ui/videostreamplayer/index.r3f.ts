/**
 * VideoStreamPlayer registration: the native (WebGL canvas) painter, which draws nothing
 * (`Component.tsx`), and its constant-zero minimum size.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { VideoStreamPlayer } from './Component';
import { videoStreamPlayerMinimumSize } from './nativeSolver';

controlSolverRegistry.registerMinimumSize('VideoStreamPlayer', videoStreamPlayerMinimumSize);

controlComponentRegistry.register({ typeName: 'VideoStreamPlayer', Component: VideoStreamPlayer });

export { VideoStreamPlayer };
