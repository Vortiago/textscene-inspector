# Feature: Node Hash Algorithm Validation

Test the FNV-1a hash algorithm implementation used for detecting node changes in the incremental update system.

## Test Environment

- **Application:** Core Library (`@tscn/renderer`)
- **Target:** Unit tests and integration tests
- **Prerequisites:**
  - Test framework (Vitest) set up
  - Test fixtures available

## Feature Overview

The hash algorithm (`nodeHash.ts`):
- Uses FNV-1a algorithm for fast, deterministic hashing
- Hashes node type, name, parent, and all properties
- Excludes children to allow independent node comparison
- Returns base36 string representation for compact storage
- Must detect all meaningful changes while avoiding false positives

## Scenarios

### Scenario 1: Identical Nodes Produce Identical Hashes

**Given** two TscnNode objects with identical properties
**When** I hash both nodes
**Then** the hashes should be exactly equal

**Validation Steps:**
1. Create node1: `{ type: "Node3D", name: "Test", properties: { transform: "..." } }`
2. Create node2: `{ type: "Node3D", name: "Test", properties: { transform: "..." } }` (exact copy)
3. Hash both nodes
4. Verify: `hash1 === hash2`
5. Test with various node types (Node3D, MeshInstance3D, Camera3D, etc.)

**Test Code:**
```typescript
import { hashTscnNode } from '@tscn/renderer';

test('identical nodes produce identical hashes', () => {
  const node1 = {
    type: 'Node3D',
    name: 'Test',
    properties: { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)' },
    parent: null,
    children: []
  };

  const node2 = { ...node1 };

  expect(hashTscnNode(node1)).toBe(hashTscnNode(node2));
});
```

---

### Scenario 2: Different Names Produce Different Hashes

**Given** two nodes that differ only in name
**When** I hash both nodes
**Then** the hashes should be different

**Validation Steps:**
1. Create node1 with `name: "NodeA"`
2. Create node2 with `name: "NodeB"` (all else identical)
3. Hash both
4. Verify: `hash1 !== hash2`

---

### Scenario 3: Different Types Produce Different Hashes

**Given** two nodes with same name but different types
**When** I hash both nodes
**Then** the hashes should be different

**Validation Steps:**
1. Create node1: `{ type: "Node3D", name: "Test" }`
2. Create node2: `{ type: "MeshInstance3D", name: "Test" }`
3. Hash both
4. Verify: `hash1 !== hash2`

---

### Scenario 4: Different Parents Produce Different Hashes

**Given** two nodes with different parent values
**When** I hash both nodes
**Then** the hashes should be different

**Validation Steps:**
1. Create node1 with `parent: "ParentA"`
2. Create node2 with `parent: "ParentB"`
3. Hash both
4. Verify: `hash1 !== hash2`

---

### Scenario 5: Different Property Values Produce Different Hashes

**Given** two nodes that differ in a single property value
**When** I hash both nodes
**Then** the hashes should be different

**Validation Steps:**
1. Create node1 with `transform: Transform3D(1, 0, 0, ...)`
2. Create node2 with `transform: Transform3D(1, 0, 0.001, ...)` (tiny difference)
3. Hash both
4. Verify: `hash1 !== hash2` (algorithm is sensitive to small changes)

---

### Scenario 6: Children Are Excluded from Hash

**Given** two identical nodes with different children
**When** I hash both nodes
**Then** the hashes should be equal (children excluded)

**Validation Steps:**
1. Create node1 with `children: [child1, child2]`
2. Create node2 (identical to node1) with `children: [child3]` (different children)
3. Hash both
4. Verify: `hash1 === hash2` (children don't affect parent's hash)

**Test Code:**
```typescript
test('children are excluded from hash', () => {
  const node1 = {
    type: 'Node3D',
    name: 'Parent',
    properties: {},
    parent: null,
    children: [{ type: 'Node3D', name: 'Child1', properties: {}, parent: 'Parent', children: [] }]
  };

  const node2 = {
    ...node1,
    children: [{ type: 'Node3D', name: 'Child2', properties: {}, parent: 'Parent', children: [] }]
  };

  expect(hashTscnNode(node1)).toBe(hashTscnNode(node2));
});
```

---

### Scenario 7: Property Order Doesn't Affect Hash

**Given** two nodes with properties in different order
**When** I hash both nodes
**Then** the hashes should be equal (deterministic ordering)

**Validation Steps:**
1. Create node1 with `properties: { a: 1, b: 2, c: 3 }`
2. Create node2 with `properties: { c: 3, a: 1, b: 2 }` (different order)
3. Hash both
4. Verify: `hash1 === hash2` (properties are sorted before hashing)

**Test Code:**
```typescript
test('property order does not affect hash', () => {
  const node1 = {
    type: 'Node3D',
    name: 'Test',
    properties: { propA: 'value1', propB: 'value2', propC: 'value3' },
    parent: null,
    children: []
  };

  const node2 = {
    type: 'Node3D',
    name: 'Test',
    properties: { propC: 'value3', propA: 'value1', propB: 'value2' },
    parent: null,
    children: []
  };

  expect(hashTscnNode(node1)).toBe(hashTscnNode(node2));
});
```

---

### Scenario 8: Hash Is Deterministic Across Multiple Calls

**Given** a single node
**When** I hash it multiple times
**Then** all hashes should be identical

**Validation Steps:**
1. Create a node
2. Hash it 100 times
3. Verify: all 100 hashes are exactly equal

---

### Scenario 9: Hash Format Is Base36 String

**Given** any node
**When** I hash it
**Then** the result should be a base36 string (0-9, a-z)

**Validation Steps:**
1. Create various nodes
2. Hash each
3. Verify: each hash matches regex `/^[0-9a-z]+$/`
4. Verify: hash length is reasonable (typically 6-7 characters for base36 from 32-bit)

---

### Scenario 10: Build Node Hash Map Creates Correct Paths

**Given** a tree of nodes with parent-child relationships
**When** I build a hash map
**Then** each node should have the correct path as key

**Validation Steps:**
1. Create tree:
   ```
   Root
   ├── Child1
   │   └── Grandchild1
   └── Child2
   ```
2. Build hash map
3. Verify map keys:
   - `"Root"` → hash of Root
   - `"Root/Child1"` → hash of Child1
   - `"Root/Child1/Grandchild1"` → hash of Grandchild1
   - `"Root/Child2"` → hash of Child2

**Test Code:**
```typescript
import { buildNodeHashMap } from '@tscn/renderer';

test('buildNodeHashMap creates correct paths', () => {
  const tree = [
    {
      type: 'Node3D',
      name: 'Root',
      properties: {},
      parent: null,
      children: [
        {
          type: 'Node3D',
          name: 'Child1',
          properties: {},
          parent: 'Root',
          children: [
            {
              type: 'Node3D',
              name: 'Grandchild1',
              properties: {},
              parent: 'Child1',
              children: []
            }
          ]
        },
        {
          type: 'Node3D',
          name: 'Child2',
          properties: {},
          parent: 'Root',
          children: []
        }
      ]
    }
  ];

  const hashMap = buildNodeHashMap(tree);

  expect(hashMap.has('Root')).toBe(true);
  expect(hashMap.has('Root/Child1')).toBe(true);
  expect(hashMap.has('Root/Child1/Grandchild1')).toBe(true);
  expect(hashMap.has('Root/Child2')).toBe(true);
  expect(hashMap.size).toBe(4);
});
```

---

### Scenario 11: Complex Property Types Are Hashed Correctly

**Given** nodes with complex property types (arrays, objects, nested structures)
**When** I hash them
**Then** the hash should reflect the full property value

**Validation Steps:**
1. Create node with complex property:
   ```typescript
   properties: {
     mesh: { type: "BoxMesh", size: [1, 2, 3] },
     material: { albedo: [1, 0, 0, 1] }
   }
   ```
2. Create identical node
3. Create node with slightly different property
4. Verify: identical nodes hash the same, different node hashes differently

---

### Scenario 12: Undefined vs Null Properties

**Given** nodes with undefined vs null property values
**When** I hash them
**Then** undefined properties should be excluded, null should be included

**Validation Steps:**
1. Create node1 with `{ propA: null, propB: "value" }`
2. Create node2 with `{ propA: undefined, propB: "value" }`
3. Create node3 with `{ propB: "value" }` (propA absent)
4. Hash all three
5. Verify: node2 and node3 produce same hash (undefined excluded)
6. Verify: node1 produces different hash (null is included)

---

### Scenario 13: Hash Collision Probability Is Low

**Given** many different nodes (stress test)
**When** I hash 1000 unique nodes
**Then** collisions should be rare or non-existent

**Validation Steps:**
1. Generate 1000 nodes with varying properties
2. Hash all nodes
3. Count unique hashes
4. Verify: unique hash count close to 1000 (collision rate <1%)

**Test Code:**
```typescript
test('low collision rate for many unique nodes', () => {
  const nodes = [];
  for (let i = 0; i < 1000; i++) {
    nodes.push({
      type: 'Node3D',
      name: `Node${i}`,
      properties: { value: i },
      parent: null,
      children: []
    });
  }

  const hashes = nodes.map(hashTscnNode);
  const uniqueHashes = new Set(hashes);

  // Should have very few collisions
  expect(uniqueHashes.size).toBeGreaterThan(990); // <1% collision rate
});
```

---

### Scenario 14: FNV-1a Algorithm Produces Unsigned 32-bit Integer

**Given** the FNV-1a hash function
**When** I hash a string
**Then** the result should be an unsigned 32-bit integer (0 to 4294967295)

**Validation Steps:**
1. Test the internal `fnv1aHash` function (if exported for testing)
2. Hash various strings
3. Verify: result is always >= 0 and <= 4294967295
4. Verify: no negative values

---

### Scenario 15: Performance Benchmark

**Given** the hash function
**When** I hash 10,000 nodes
**Then** the operation should complete in reasonable time (<100ms)

**Validation Steps:**
1. Create 10,000 nodes with realistic properties
2. Time the hashing operation
3. Verify: total time < 100ms
4. Calculate: average time per node < 0.01ms

**Test Code:**
```typescript
test('hash performance is acceptable', () => {
  const nodes = Array.from({ length: 10000 }, (_, i) => ({
    type: 'Node3D',
    name: `Node${i}`,
    properties: {
      transform: `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${i}, 0, 0)`
    },
    parent: null,
    children: []
  }));

  const startTime = performance.now();
  nodes.forEach(hashTscnNode);
  const endTime = performance.now();

  const duration = endTime - startTime;
  expect(duration).toBeLessThan(100); // Should complete in <100ms
});
```

---

## Expected Hash Characteristics

### Format:
- Type: String
- Encoding: Base36 (characters: 0-9, a-z)
- Typical length: 6-7 characters
- Example: `"1y2p0ij"`

### Properties:
- **Deterministic**: Same input always produces same output
- **Fast**: <0.01ms per node on average
- **Low collision**: <1% collision rate for realistic node sets
- **Sensitive**: Detects even small property changes
- **Order-independent**: Property order doesn't matter

### Exclusions:
- Children are excluded
- Undefined properties are excluded
- Internal implementation details excluded

## Success Criteria

✅ Identical nodes always produce identical hashes
✅ Different names/types/parents/properties produce different hashes
✅ Children are excluded from hash calculation
✅ Property order doesn't affect hash (deterministic)
✅ Hash is deterministic across multiple calls
✅ Hash format is valid base36 string
✅ buildNodeHashMap creates correct node paths
✅ Complex property types hashed correctly
✅ Undefined properties excluded, null included
✅ Low collision probability (<1%)
✅ FNV-1a produces unsigned 32-bit integers
✅ Performance is acceptable (<100ms for 10k nodes)

## Unit Test Coverage

The following test file should be created:
- `packages/textscene-renderer/src/utils/nodeHash.test.ts`

Test suites:
1. `describe('hashTscnNode')` - Core hashing logic
2. `describe('buildNodeHashMap')` - Hash map construction
3. `describe('fnv1aHash')` - Algorithm internals
4. `describe('performance')` - Performance benchmarks
