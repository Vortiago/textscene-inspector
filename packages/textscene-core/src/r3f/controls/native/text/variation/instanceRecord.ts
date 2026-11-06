/**
 * The `FeatureVariations` record of a `GSUB` or `GPOS` table that holds at an instance, as HarfBuzz
 * finds it from the coordinates FreeType hands it.
 */

import { featureSubstitutionAt, type FeatureSubstitution, type LayoutTable } from '../autofit/openTypeLayout';
import { fixedToFdot14 } from './fixedPoint';

/** The record for the 16.16 `normalized` coordinates of an instance, or undefined for none. */
export function featureSubstitutionOfInstance(
  table: LayoutTable,
  normalized: Int32Array
): FeatureSubstitution | undefined {
  return featureSubstitutionAt(table, Array.from(normalized, fixedToFdot14));
}
