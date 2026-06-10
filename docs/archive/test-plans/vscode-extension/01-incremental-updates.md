# Feature: Incremental Scene Updates

Test the hash-based incremental update system for the TSCN VS Code extension, which intelligently applies changes without full scene reloads while preserving camera state.

## Test Environment

- **Application:** VS Code Extension
- **Target:** VS Code with TSCN File Previewer extension installed
- **Prerequisites:**
  - VS Code running with extension loaded
  - Test fixtures available in `tests/fixtures/`
  - Extension packaged and installed (.vsix)

## Feature Overview

The incremental update system:
- Uses FNV-1a hashing to detect node changes
- Compares old and new scene states to identify add/remove/update operations
- Applies changes surgically without clearing the entire scene
- Preserves camera position and rotation during updates
- Falls back to full reload when >50% of nodes change or structure changes significantly

## Scenarios

### Scenario 1: Single Node Property Update

**Given** a TSCN file is open with 4 nodes in the preview
**When** I modify a single node's Transform3D property and save
**Then** only that node should be updated in the 3D scene
**And** the camera position should remain unchanged
**And** other nodes should not be re-rendered
**And** the scene tree viewer should update to show the new property value

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn` in VS Code
2. Note the initial camera position in the preview
3. Edit the file: change `Node3D Child1` transform from `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)` to `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, 0)` (move 5 units on X-axis)
4. Save the file
5. Verify in the preview:
   - Only Child1 cube moved to new position
   - Camera did not reset to default position
   - Root node and other children remain in original positions
6. Check console for incremental update log (should say "Applying incremental update with X changes")

**Test Fixture:**
```tscn
[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

[node name="Child2" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
```

---

### Scenario 2: Add New Node to Existing Scene

**Given** a TSCN file is open with a basic scene
**When** I add a new child node and save
**Then** the new node should appear in the 3D preview
**And** existing nodes should not be re-rendered
**And** the camera should remain in its current position
**And** the scene tree should show the new node

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn` in VS Code
2. Rotate camera to a specific angle in preview
3. Add a new node to the file:
   ```tscn
   [node name="NewChild" type="Node3D" parent="."]
   transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
   ```
4. Save the file
5. Verify:
   - New cube appears at position (-2, 0, 0)
   - Camera angle remains unchanged
   - Scene tree now shows "NewChild" node
   - Console shows "Applying incremental update" with 1 added node

---

### Scenario 3: Remove Node from Scene

**Given** a TSCN file with multiple nodes is open
**When** I delete a node from the file and save
**Then** the node should disappear from the 3D preview
**And** other nodes should remain visible and unchanged
**And** the camera position should be preserved

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn` with 4 nodes
2. Position camera at a specific view angle
3. Delete the entire `[node name="Child2" ...]` section from the file
4. Save the file
5. Verify:
   - Child2 cube disappears from preview
   - Root and other children remain visible
   - Camera position unchanged
   - Scene tree no longer shows Child2
   - Node count updates from "Nodes: 4" to "Nodes: 3"

---

### Scenario 4: Multiple Node Updates in Single Save

**Given** a TSCN file with multiple nodes
**When** I modify several nodes' properties at once and save
**Then** all modified nodes should update correctly
**And** unmodified nodes should remain unchanged
**And** camera state should be preserved

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn`
2. Set camera to a specific position
3. Modify 2 nodes:
   - Change Child1 position to (1, 1, 1)
   - Change Child2 position to (2, 2, 2)
4. Save file
5. Verify:
   - Both nodes moved to new positions
   - Root node unchanged
   - Camera position preserved
   - Console shows "Applying incremental update with 2 changes"

---

### Scenario 5: Full Reload Triggered (>50% Changed)

**Given** a TSCN file with 10 nodes
**When** I modify 6 or more nodes (>50%) and save
**Then** the system should perform a full reload instead of incremental update
**And** the scene should render correctly with all changes

**Validation Steps:**
1. Open `tests/fixtures/large_hierarchy_wide.tscn` (101 nodes)
2. Modify 51+ nodes by changing their transforms
3. Save file
4. Verify console shows "Performing full reload" (not incremental)
5. Verify all changes applied correctly
6. Note: Camera may reset (expected behavior for full reload)

---

### Scenario 6: Structural Changes Trigger Full Reload

**Given** a TSCN file with a hierarchy
**When** I add and remove multiple nodes (structural changes >30% of total)
**Then** the system should detect structural instability and perform full reload

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn` (4 nodes)
2. Add 2 new nodes and remove 2 existing nodes (50% structural change)
3. Save file
4. Verify console shows "Performing full reload" due to structural changes
5. Verify final scene matches the new structure

---

### Scenario 7: Camera State Preservation During Incremental Update

**Given** a TSCN file is open and I have orbited the camera to a custom position
**When** I make a small change (1 node property) and save
**Then** the camera position, rotation, and zoom should remain exactly the same
**And** orbit controls should continue working from the same state

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn`
2. Use mouse to:
   - Orbit camera to position (15, 20, 15)
   - Zoom in close to a specific node
   - Note the exact view angle
3. Edit file: change one transform value
4. Save file
5. Verify:
   - Camera position unchanged (still at ~15, 20, 15)
   - Zoom level maintained
   - View angle exactly the same
   - Can continue orbiting from current position without jump/reset

---

### Scenario 8: Rapid Sequential Saves (Debouncing)

**Given** a TSCN file is open
**When** I save the file multiple times in quick succession
**Then** each save should trigger proper incremental updates
**And** the system should not get into an inconsistent state
**And** no updates should be lost or applied out of order

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn`
2. Make change 1: modify Child1 position
3. Save
4. Immediately make change 2: modify Child2 position (within 500ms)
5. Save
6. Make change 3: add new node
7. Save
8. Verify:
   - All 3 changes applied correctly
   - No intermediate states skipped
   - Console shows 3 separate update operations
   - Scene matches final file content

---

### Scenario 9: Hash Collision Resistance

**Given** two different node configurations
**When** I change a node in a way that might cause hash collision
**Then** the hash should detect the change correctly
**And** the node should update as expected

**Validation Steps:**
1. Create test file with node at position (1, 2, 3)
2. Save and verify hash generated
3. Change position to (3, 2, 1) - same digits, different order
4. Save
5. Verify:
   - Hash changed (different value)
   - Update detected
   - Node position updated in preview

---

### Scenario 10: Node Rename Detection

**Given** a TSCN file with named nodes
**When** I rename a node (keeping same type and parent)
**Then** the system should detect this as remove + add (not update)
**And** the scene should update correctly

**Validation Steps:**
1. Open file with `[node name="OldName" type="Node3D"]`
2. Position camera
3. Change to `[node name="NewName" type="Node3D"]`
4. Save
5. Verify:
   - Console shows 1 removal and 1 addition
   - Scene tree shows "NewName" instead of "OldName"
   - Visual representation remains (cube in same position if transform unchanged)

---

### Scenario 11: Parent Relationship Changes

**Given** a node hierarchy with parent-child relationships
**When** I change a node's parent
**Then** the system should detect removal from old parent and addition to new parent
**And** the node should visually move to be under the new parent's transform

**Validation Steps:**
1. Open file with:
   ```
   [node name="Parent1" ...]
   [node name="Child" parent="Parent1" ...]
   [node name="Parent2" ...]
   ```
2. Change `[node name="Child" parent="Parent2" ...]`
3. Save
4. Verify:
   - Child moved under Parent2 in scene tree
   - Transform inheritance updated (visual position may change)
   - Incremental update applied correctly

---

### Scenario 12: Empty Scene to Populated Scene

**Given** an empty TSCN file is open
**When** I add multiple nodes (creating a full scene) and save
**Then** the system should add all nodes incrementally
**And** the camera should remain at default position

**Validation Steps:**
1. Open `tests/fixtures/empty_scene.tscn`
2. Verify "Nodes: 0" in scene info
3. Add 5 nodes to the file
4. Save
5. Verify:
   - All 5 nodes appear in preview
   - Console shows "Adding" messages for all nodes
   - Scene tree shows all 5 nodes
   - "Nodes: 5" in scene info

---

### Scenario 13: Populated Scene to Empty Scene

**Given** a TSCN file with multiple nodes
**When** I delete all nodes (keeping only header) and save
**Then** all nodes should be removed from the preview
**And** the scene should show empty state

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn` (4 nodes)
2. Delete all node sections, keeping only header
3. Save
4. Verify:
   - All cubes disappear from preview
   - Scene tree shows "No nodes to display"
   - "Nodes: 0" in scene info
   - Console shows removal operations

---

### Scenario 14: Error During Incremental Update (Graceful Fallback)

**Given** a valid TSCN file is open
**When** I introduce a malformed change that causes incremental update to fail
**Then** the system should log the error and fall back to full reload
**And** the error should be displayed to the user

**Validation Steps:**
1. Open valid TSCN file
2. Introduce malformed syntax in one node (e.g., invalid transform format)
3. Save file
4. Verify:
   - Console shows error: "Error applying incremental update"
   - System attempts fallback to full reload OR displays error message
   - UI remains responsive (no crash)

---

### Scenario 15: Node Type Change (Remove + Add)

**Given** a node with a specific type
**When** I change the node's type while keeping the same name
**Then** the system should detect this as a hash change
**And** the node should update to the new type representation

**Validation Steps:**
1. Open file with `[node name="TestNode" type="Node3D"]`
2. Change to `[node name="TestNode" type="MeshInstance3D"]`
3. Add mesh data if needed
4. Save
5. Verify:
   - Console shows node update
   - Visual representation changes (if applicable)
   - Scene tree shows correct type icon/label

---

## Expected Console Messages

### Incremental Update:
```
[TscnPreviewPanel] Applying incremental update with 2 changes
  - Adding node: Root/NewChild
  - Updating node: Root/Child1
```

### Full Reload:
```
[TscnPreviewPanel] Change ratio 0.67 > 0.5, performing full reload
```

### Structural Change:
```
[TscnPreviewPanel] Structural changes detected (add/remove), performing full reload
```

## Success Criteria

✅ Single node property changes apply incrementally without full reload
✅ Camera position and rotation preserved during incremental updates
✅ Add/remove operations work correctly
✅ Multiple simultaneous changes handled properly
✅ Full reload triggered when >50% nodes change
✅ Structural changes (add/remove) trigger appropriate strategy
✅ Rapid sequential saves processed correctly without corruption
✅ Hash algorithm detects all meaningful changes
✅ Node renames, parent changes, and type changes handled correctly
✅ Empty <-> populated transitions work
✅ Errors during incremental update handled gracefully with fallback
✅ Console messages clearly indicate which strategy was used

## Performance Expectations

- Incremental updates should complete in <100ms for small changes
- Full reloads may take longer but should remain responsive
- No visible flickering during incremental updates
- Camera should not "jump" or "reset" during incremental updates
