import { describe, expect, it } from 'vitest';
import { parseGraphEditConnections } from './connections';

describe('parseGraphEditConnections', () => {
  it('parses one Dictionary entry, StringName endpoints and int ports', () => {
    // graph_edit.cpp:2541 reads d["from_node"]/["from_port"]/["to_node"]/["to_port"].
    const result = parseGraphEditConnections(
      '[{ "from_node": &"Source", "from_port": 0, "to_node": &"Sink", "to_port": 1, "keep_alive": true }]'
    );
    expect(result).toEqual([{ fromNode: 'Source', fromPort: 0, toNode: 'Sink', toPort: 1 }]);
  });

  it('parses the Array[Dictionary]([...]) wrapper (graph_edit.cpp:3083 PROPERTY_HINT_ARRAY_TYPE)', () => {
    const result = parseGraphEditConnections(
      'Array[Dictionary]([{ "from_node": &"A", "from_port": 0, "to_node": &"B", "to_port": 0 }])'
    );
    expect(result).toEqual([{ fromNode: 'A', fromPort: 0, toNode: 'B', toPort: 0 }]);
  });

  it('parses multiple entries', () => {
    const result = parseGraphEditConnections(
      '[{ "from_node": &"A", "from_port": 0, "to_node": &"B", "to_port": 0 }, ' +
        '{ "from_node": &"B", "from_port": 1, "to_node": &"C", "to_port": 0 }]'
    );
    expect(result).toEqual([
      { fromNode: 'A', fromPort: 0, toNode: 'B', toPort: 0 },
      { fromNode: 'B', fromPort: 1, toNode: 'C', toPort: 0 },
    ]);
  });

  it('accepts a plain (non-StringName) quoted node name', () => {
    const result = parseGraphEditConnections('[{ "from_node": "A", "from_port": 0, "to_node": "B", "to_port": 0 }]');
    expect(result).toEqual([{ fromNode: 'A', fromPort: 0, toNode: 'B', toPort: 0 }]);
  });

  it('returns [] for an empty array', () => {
    expect(parseGraphEditConnections('[]')).toEqual([]);
  });

  it('returns [] when the value is absent', () => {
    expect(parseGraphEditConnections(undefined)).toEqual([]);
  });

  it('drops an entry missing a required field rather than throwing', () => {
    const result = parseGraphEditConnections('[{ "from_node": &"A", "to_node": &"B", "to_port": 0 }]');
    expect(result).toEqual([]);
  });

  it('returns [] for a malformed (non-array) literal', () => {
    expect(parseGraphEditConnections('not an array')).toEqual([]);
  });
});
