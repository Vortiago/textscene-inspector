/**
 * Registers TabBar's solvers: the minimum size and the texture slots. Every module that solves a
 * TabBar, TabContainer's strip included, imports this one.
 */
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { tabBarMinimumSize } from './minimumSize';
import { tabBarTextureSlots } from './nativeSolver';

controlSolverRegistry.registerMinimumSize('TabBar', tabBarMinimumSize);
controlSolverRegistry.registerTextureSlots('TabBar', tabBarTextureSlots);
