/**
 * FlowContainer registration — the native (WebGL canvas) rect solve +
 * painter. `./nativeSolver` registers the container-layout/minimum-size
 * functions for FlowContainer, HFlowContainer AND VFlowContainer as a side
 * effect of import (one solver, parameterised by orientation — see its own
 * doc) — `hflowcontainer`/`vflowcontainer`'s own `index.r3f.ts` import it too
 * so either one alone still wires all three.
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { FlowContainer } from './Component';
import './nativeSolver';

controlComponentRegistry.register({
  typeName: 'FlowContainer',
  Component: FlowContainer,
});

export { FlowContainer };
