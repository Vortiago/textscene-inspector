import { nodeComponentRegistry } from '../../NodeComponentRegistry';
import { GLBSceneRoot, GLB_SCENE_ROOT_TYPE } from './Component';

nodeComponentRegistry.register({ typeName: GLB_SCENE_ROOT_TYPE, Component: GLBSceneRoot });

export { GLBSceneRoot, GLB_SCENE_ROOT_TYPE };
