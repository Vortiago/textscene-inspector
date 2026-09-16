/**
 * `connections` — `graph_edit.cpp:3083`'s `Array[Dictionary]`. `set_connections`
 * (`:2533-2543`) reads each entry with a bare `d["from_node"]`/`["from_port"]`/
 * `["to_node"]`/`["to_port"]`, which auto-vivifies a null `Variant` for a
 * missing key rather than failing — a malformed or incomplete entry here just
 * drops out, matching that leniency.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { arrayLiteralBody, dictNumberField } from '../../../../godot/variantParser.js';
import { unquoteStringName } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { GraphEditConnection } from './types';

/** One `{...}` Dictionary block; connection entries hold only scalar fields, so no nested brace ever occurs. */
const DICT_BLOCK_RE = /\{[^{}]*\}/g;

/** A Dictionary field whose value is a quoted string, optionally StringName-jacketed (`d[key]` written as a `StringName` — `variant_writer.cpp`'s `&"…"`). */
function dictStringField(key: string): RegExp {
  return new RegExp(`"${key}"\\s*:\\s*([&@]?"(?:[^"\\\\]|\\\\[\\s\\S])*")\\s*(?=[,}])`);
}

export function parseGraphEditConnections(raw: string | undefined): GraphEditConnection[] {
  if (raw === undefined) return [];
  const body = arrayLiteralBody(raw);
  if (body === null) return [];

  const connections: GraphEditConnection[] = [];
  for (const block of body.match(DICT_BLOCK_RE) ?? []) {
    const fromNodeMatch = dictStringField('from_node').exec(block);
    const toNodeMatch = dictStringField('to_node').exec(block);
    const fromPortMatch = dictNumberField('from_port').exec(block);
    const toPortMatch = dictNumberField('to_port').exec(block);
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
