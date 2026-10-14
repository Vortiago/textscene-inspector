import { nodeComponentRegistry } from '../../NodeComponentRegistry';
import { GLBSceneRoot } from './Component';
import { GLB_SCENE_ROOT_TYPE } from '../../../resources/glbSceneRoot';

nodeComponentRegistry.register({ typeName: GLB_SCENE_ROOT_TYPE, Component: GLBSceneRoot });
