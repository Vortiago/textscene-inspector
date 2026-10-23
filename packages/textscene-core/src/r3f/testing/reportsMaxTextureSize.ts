/** The mock context reports no `MAX_TEXTURE_SIZE`, so a test that fits an atlas to the GPU sets one. */

import { patchesContext } from './patchesContext';

/** Makes the test canvas's context report `size` as the GPU's largest texture side. */
export function reportsMaxTextureSize(size: number) {
  return patchesContext((context) => {
    const getParameter = context.getParameter.bind(context);
    context.getParameter = (parameter: number) =>
      parameter === context.MAX_TEXTURE_SIZE ? size : getParameter(parameter);
  });
}
