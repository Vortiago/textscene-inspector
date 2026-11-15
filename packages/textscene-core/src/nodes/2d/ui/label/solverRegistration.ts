/**
 * Registers Label's solvers. Every module that solves a Label, the title a GraphElement builds
 * included, imports this one.
 */
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { isLabelAutowrapped, labelMinimumSize } from './nativeSolver';

controlSolverRegistry.registerMinimumSize('Label', labelMinimumSize);
// With autowrap on, the minimum height is the text wrapped at this control's
// width, which only a completed pass knows (`SolveContext.tentativeRect`).
controlSolverRegistry.registerSizeDependentMinimum('Label', isLabelAutowrapped);
