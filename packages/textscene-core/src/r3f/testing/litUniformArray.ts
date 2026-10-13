/** The float array a lit uniform holds now, as the lit materials read it. */

import { installedUniformValue } from '../shaderPatch/litUniform';

export function litUniformArray(name: string): Float32Array {
  const value = installedUniformValue(name);
  if (!(value instanceof Float32Array))
    throw new Error(`expected a Float32Array in ${name}, found ${String(value)}`);
  return value;
}
