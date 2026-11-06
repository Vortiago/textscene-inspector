/**
 * The lookups HarfBuzz's default shaper runs for a script: its features before and after `rvrn`'s
 * pause, the default script it falls back on, and the `FeatureVariations` record that changes them.
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import { perObject } from '../../../../../utils/perObject';
import {
  DEFAULT_FEATURES,
  featureSubstitutionAt,
  type FeatureSubstitution,
  languageFeatures,
  type LayoutTable,
} from './openTypeLayout';

/** HarfBuzz's feature of the default shaper before `rvrn`'s pause (`hb-ot-shape.cc:329-376`). */
export const FIRST_STAGE_FEATURES = ['rvrn'] as const;

/** The scripts of the auto-hinter that HarfBuzz sets right to left (`hb_script_get_horizontal_direction`). */
const RIGHT_TO_LEFT_SCRIPT_TAGS: ReadonlySet<string> = new Set([
  'adlm',
  'arab',
  'avst',
  'cprt',
  'hebr',
  'nko ',
  'rohg',
]);

/** The features after `rvrn`'s pause for text of `scriptTags`, with `feature` on. */
export function shapingFeatures(scriptTags: readonly string[], feature: string | null): string[] {
  const isRightToLeft = scriptTags.some((tag) => RIGHT_TO_LEFT_SCRIPT_TAGS.has(tag));
  const directionFeatures = isRightToLeft ? ['rtla', 'rtlm'] : ['ltra', 'ltrm'];
  return [...directionFeatures, ...DEFAULT_FEATURES, ...(feature ? [feature] : [])];
}

/** The default script HarfBuzz falls back on, then the two it tries after it (`hb_ot_layout_table_select_script`). */
const FALLBACK_SCRIPT_TAGS = ['DFLT', 'dflt', 'latn'] as const;

/** The `FeatureVariations` record that holds at the default instance, found once for a table. */
export const defaultSubstitution = perObject((table: LayoutTable) => featureSubstitutionAt(table, []));

/** The lookups of `features` under the first script of `scriptTags` the table has, its default language, as `substitution` changes them. */
export function featureLookups(
  table: LayoutTable,
  scriptTags: readonly string[],
  features: readonly string[],
  substitution: FeatureSubstitution | undefined
): number[] {
  const script = [...scriptTags, ...FALLBACK_SCRIPT_TAGS]
    .map((tag) => table.scripts.find((candidate) => candidate.tag === tag))
    .find((found) => found !== undefined);
  const language = script?.defaultLanguage;
  if (!language) return [];
  const indices = languageFeatures(table, language, features);
  const lookupsOf = (index: number): readonly number[] =>
    substitution?.substitutions.get(index) ?? table.features[index]?.lookups ?? [];
  const lookups = new Set(indices.flatMap(lookupsOf));
  return [...lookups].sort((a, b) => a - b);
}
