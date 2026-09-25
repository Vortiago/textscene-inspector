/**
 * `connections`, the `Array[Dictionary]` of `graph_edit.cpp:3083`. `set_connections` (`:2533-2543`)
 * reads each field with a bare `d["from_node"]`, which yields a null `Variant` for a missing key
 * rather than failing, so a malformed or incomplete entry here drops out.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  arrayLiteralBody,
  dictNumberField,
  dictStringField,
} from '../../../../godot/variantParser.js';
import { unquoteStringName } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { GraphEditConnection } from './types';

/** One `{...}` Dictionary block; connection entries hold only scalar fields, so no nested brace ever occurs. */
const DICT_BLOCK_RE = /\{[^{}]*\}/g;

const FROM_NODE_RE = dictStringField('from_node');
const TO_NODE_RE = dictStringField('to_node');
const FROM_PORT_RE = dictNumberField('from_port');
const TO_PORT_RE = dictNumberField('to_port');

export function parseGraphEditConnections(raw: string | undefined): GraphEditConnection[] {
  if (raw === undefined) return [];
  const body = arrayLiteralBody(raw);
  if (body === null) return [];

  const connections: GraphEditConnection[] = [];
  for (const block of body.match(DICT_BLOCK_RE) ?? []) {
    const fromNodeMatch = FROM_NODE_RE.exec(block);
    const toNodeMatch = TO_NODE_RE.exec(block);
    const fromPortMatch = FROM_PORT_RE.exec(block);
    const toPortMatch = TO_PORT_RE.exec(block);
    if (!fromNodeMatch || !toNodeMatch || !fromPortMatch || !toPortMatch) continue;

    const fromPort = parseOptionalInt(fromPortMatch[1]);
    const toPort = parseOptionalInt(toPortMatch[1]);
    if (fromPort === undefined || toPort === undefined) continue;

    connections.push({
      fromNode: unquoteStringName(fromNodeMatch[1]!),
      toNode: unquoteStringName(toNodeMatch[1]!),
      fromPort,
      toPort,
    });
  }
  return connections;
}
