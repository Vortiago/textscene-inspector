/**
 * Parses a Tree: the Control base plus `columns`/`column_titles_visible`. Rows never serialise,
 * since `TreeItem` is not a `Node` (`scene/gui/tree.h`), and column titles have no property
 * (`tree.cpp:6807-6823` is the whole list), so both are script-only and a header row draws blank.
 */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseControl } from '../control/parser';
import type { TreeProperties } from './types';

export function parseTree(
  heading: ParsedHeading,
  properties: Record<string, string>
): TreeProperties {
  return {
    ...parseControl(heading, properties),
    columns: parseOptionalInt(properties.columns),
    columnTitlesVisible: parseOptionalBool(properties.column_titles_visible),
  };
}
