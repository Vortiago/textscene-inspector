/**
 * The load options of a GLB that has no import sidecar, whose file name names nothing, and whose
 * images record no import format.
 */
import { importGltfNaming } from '../../../../parser/importParser';
import type { GlbLoadOptions } from '../glbProcessing';

export const NO_SIDECAR: GlbLoadOptions = {
  naming: { ...importGltfNaming(null), fileName: '' },
  imageFormat: async () => null,
};
