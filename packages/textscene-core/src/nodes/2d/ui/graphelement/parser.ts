/**
 * GraphElement parser — Control + the six own members `_bind_methods` adds.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalVector2 } from '../../../../parser/valueParsers';
import type { GraphElementProperties } from './types';
import { parseControl } from '../control/parser';

export function parseGraphElement(
  heading: ParsedHeading,
  properties: Record<string, string>
): GraphElementProperties {
  const result: GraphElementProperties = { ...parseControl(heading, properties) };

  result.positionOffset = parseOptionalVector2(properties.position_offset);
  result.resizable = parseOptionalBool(properties.resizable);
  result.draggable = parseOptionalBool(properties.draggable);
  const selectable = parseOptionalBool(properties.selectable);
  result.selectable = selectable;
  result.scalingMenus = parseOptionalBool(properties.scaling_menus);

  // `GraphElement::set_selectable` forces `set_selected(false)` whenever
  // `p_selectable` is false (graph_element.cpp:205-210), unconditionally on
  // load order — a false `selectable` always wins over an authored `selected`.
  result.selected = selectable === false ? false : parseOptionalBool(properties.selected);

  return result;
}
