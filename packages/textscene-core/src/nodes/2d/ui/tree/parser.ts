/**
 * Tree parser — Control base plus `columns`/`column_titles_visible`, the
 * only two of Tree's 16 own members this previewer's picture depends on.
 *
 * A Tree's ROWS are never serialised: `TreeItem` is not a `Node`
 * (`scene/gui/tree.h`), so it can never appear as a child in a `.tscn`, and
 * every row/cell is created only from script via `Tree::create_item()`.
 * Column TITLES are equally absent — `Tree::columns` (the internal `Vector<Column>`
 * that carries each title's text) has no `_set`/`_get`/`get_property_list`/
 * `PropertyListHelper` override and no `ADD_PROPERTY` of its own
 * (`tree.cpp:6807-6823` is the WHOLE property list), so `set_column_title` is
 * script-only too. A Tree in a `.tscn` therefore always renders its header
 * row (when visible) with every title BLANK.
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
