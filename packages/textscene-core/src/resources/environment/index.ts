/**
 * `Environment` resource slice entry point (ADR-0031): the routing claim plus
 * the decode surface. THREE-free and React-free — `build.ts` and the shader
 * builders behind it are what the render layer imports, and nothing on the
 * routing side may pull those in.
 *
 * An Environment reaches this slice both ways: inline as a `[sub_resource]` of
 * the scene that shows it, and as a standalone `.tres` on the generic
 * `resource` slot. Both are a ParsedResource body, and this slice's decode is
 * what gives that body meaning.
 */

import { registerResourceSlice } from '../sliceRegistration';

registerResourceSlice({
  slice: 'environment',
  kind: 'godot-text',
  typeNames: ['Environment'],
  busType: 'resource',
  failureLabel: 'Resource',
});

export { decodeEnvironment } from './decode';
export {
  BackgroundMode,
  type EnvironmentProperties,
  type EnvironmentSettings,
} from './types';
