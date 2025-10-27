# Feature: Multi-Panel Management

Test the VS Code extension's ability to manage multiple TSCN preview panels simultaneously, with each file having its own independent preview instance.

## Test Environment

- **Application:** VS Code Extension
- **Target:** VS Code with TSCN File Previewer extension installed
- **Prerequisites:**
  - Multiple TSCN test files available
  - Extension packaged and installed

## Feature Overview

The multi-panel system:
- Creates one preview panel per opened TSCN file
- Each panel maintains independent state (camera, scene, resources)
- Panels can be arranged in VS Code's editor layout (side-by-side, grid, etc.)
- Changes to one file only update its corresponding panel
- Closing a file disposes of its preview panel

## Scenarios

### Scenario 1: Open Single TSCN File

**Given** VS Code is open with no TSCN files
**When** I open a TSCN file
**Then** a single preview panel should open beside the text editor
**And** the panel should show the 3D preview of that file
**And** the panel title should match the filename

**Validation Steps:**
1. Open VS Code
2. Open `tests/fixtures/simple_node3d.tscn`
3. Verify:
   - Preview panel opens automatically
   - Panel title shows "TSCN Preview: simple_node3d.tscn"
   - 3D scene renders correctly
   - Scene tree shows nodes from this file

---

### Scenario 2: Open Two TSCN Files Simultaneously

**Given** VS Code is open
**When** I open two different TSCN files
**Then** two separate preview panels should open
**And** each panel should show its corresponding file's content
**And** panels should be independently navigable

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn`
2. Verify first preview panel opens
3. Open `tests/fixtures/empty_scene.tscn`
4. Verify:
   - Second preview panel opens
   - Panel 1 title: "TSCN Preview: simple_node3d.tscn" (4 nodes)
   - Panel 2 title: "TSCN Preview: empty_scene.tscn" (0 nodes)
   - Both panels visible in editor layout
   - Each panel has independent scene content

---

### Scenario 3: Edit One File While Multiple Are Open

**Given** two TSCN files are open with preview panels
**When** I edit and save one file
**Then** only that file's preview panel should update
**And** the other panel should remain unchanged

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn` (Panel A)
2. Open `tests/fixtures/mesh_instance.tscn` (Panel B)
3. Edit `simple_node3d.tscn`: change a transform
4. Save the file
5. Verify:
   - Panel A updates with the change
   - Panel B remains exactly the same (no refresh)
   - Panel B's camera position unchanged
   - Console shows update only for Panel A

---

### Scenario 4: Independent Camera States

**Given** multiple TSCN files are open with previews
**When** I orbit the camera in one panel
**Then** that camera movement should not affect other panels
**And** each panel should maintain its own camera state

**Validation Steps:**
1. Open 2 TSCN files with previews
2. In Panel A: orbit camera to position (20, 10, 5)
3. In Panel B: orbit camera to position (5, 15, 10)
4. Switch between panels
5. Verify:
   - Panel A camera remains at (20, 10, 5)
   - Panel B camera remains at (5, 15, 10)
   - Camera positions don't influence each other

---

### Scenario 5: Close One Panel, Keep Others Open

**Given** three TSCN preview panels are open
**When** I close one panel
**Then** that panel should be disposed
**And** the other panels should remain functional

**Validation Steps:**
1. Open 3 TSCN files with previews
2. Close Panel 2 (middle panel)
3. Verify:
   - Panel 2 disappears
   - Panels 1 and 3 remain open and functional
   - Can still interact with remaining panels (orbit camera, etc.)
   - Memory is freed (check Task Manager if needed)

---

### Scenario 6: Close File Closes Corresponding Panel

**Given** a TSCN file is open with its preview panel
**When** I close the TSCN file in the text editor
**Then** its preview panel should also close automatically

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn`
2. Verify preview panel is open
3. Close the text editor tab for `simple_node3d.tscn`
4. Verify:
   - Preview panel closes automatically
   - No orphaned panels remain
   - VS Code workspace is clean

---

### Scenario 7: Reopen Previously Closed File

**Given** I previously had a TSCN file open with a preview
**When** I close it and then reopen the same file
**Then** a new preview panel should open
**And** the camera should be at default position (fresh state)

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn`
2. Orbit camera to custom position
3. Close the file (and its panel)
4. Reopen `tests/fixtures/simple_node3d.tscn`
5. Verify:
   - New preview panel opens
   - Camera is at default position (10, 10, 10), not previous custom position
   - Scene renders correctly
   - Panel has fresh state (no lingering data from before)

---

### Scenario 8: Side-by-Side Layout Comparison

**Given** two TSCN files are open
**When** I arrange them side-by-side in VS Code
**Then** I should be able to compare both previews simultaneously
**And** both should remain fully interactive

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn`
2. Open `tests/fixtures/large_hierarchy_wide.tscn`
3. Drag panels to arrange side-by-side
4. Verify:
   - Both previews visible at the same time
   - Can orbit camera in Panel A while viewing Panel B
   - Can interact with both independently
   - No performance degradation

---

### Scenario 9: Maximum Panel Limit (Stress Test)

**Given** VS Code is open
**When** I open 10 TSCN files with previews
**Then** all panels should open without crashing
**And** performance should remain acceptable

**Validation Steps:**
1. Open 10 different TSCN files sequentially
2. Verify:
   - All 10 preview panels open
   - VS Code remains responsive
   - Each panel renders correctly
   - Memory usage is reasonable (check Task Manager)
   - Can close all panels without issues

---

### Scenario 10: Panel Focus and Active State

**Given** multiple TSCN preview panels are open
**When** I click on a specific panel
**Then** that panel should become active/focused
**And** keyboard shortcuts should apply to the active panel

**Validation Steps:**
1. Open 2 TSCN files with previews
2. Click on Panel A
3. Verify Panel A is focused (visual indicator)
4. Click on Panel B
5. Verify Panel B is now focused
6. Test: press a keyboard shortcut (if any) and verify it applies to focused panel

---

### Scenario 11: Update Propagation for Same File in Multiple Editors

**Given** the same TSCN file is open in two split editor views
**When** I edit the file in one view and save
**Then** both editors' preview panels should update
**And** both should show the same updated content

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn`
2. Split editor to show same file twice
3. Verify 2 preview panels open (or 1 shared panel - depends on implementation)
4. Edit file in left editor: change a transform
5. Save
6. Verify:
   - Both preview panels update (if separate)
   - OR single shared panel updates (if panels are unified)
   - Content is consistent across all views

---

### Scenario 12: Panel Restoration After VS Code Restart

**Given** I have TSCN files open with previews
**When** I close and restart VS Code with workspace restoration
**Then** the TSCN files should reopen
**And** preview panels should automatically recreate

**Validation Steps:**
1. Open 2 TSCN files with previews
2. Close VS Code (allowing workspace save)
3. Reopen VS Code
4. Verify:
   - TSCN text editors restore
   - Preview panels automatically reopen
   - Scenes render correctly
   - Camera positions are at default (fresh state)

---

### Scenario 13: Panel Title Reflects File Path

**Given** TSCN files in different directories with same name
**When** I open both files
**Then** panel titles should differentiate them by path
**And** I should be able to identify which panel belongs to which file

**Validation Steps:**
1. Create two files:
   - `tests/fixtures/scene.tscn`
   - `tests/other/scene.tscn`
2. Open both files
3. Verify:
   - Panel titles show distinguishing information
   - Example: "TSCN Preview: fixtures/scene.tscn" vs "TSCN Preview: other/scene.tscn"
   - Can easily identify which panel is which

---

### Scenario 14: Memory Cleanup on Panel Close

**Given** a TSCN file with a large scene is open
**When** I close the file and its preview panel
**Then** memory should be freed (garbage collected)
**And** three.js resources should be disposed

**Validation Steps:**
1. Note initial memory usage (VS Code Task Manager)
2. Open `tests/fixtures/large_hierarchy_wide.tscn` (101 nodes)
3. Note memory increase
4. Close the file and panel
5. Wait 10 seconds for GC
6. Verify:
   - Memory usage decreases (back toward initial level)
   - No memory leaks (repeat open/close cycle 5 times)
   - Console shows disposal messages if logged

---

### Scenario 15: Error in One Panel Doesn't Affect Others

**Given** multiple TSCN preview panels are open
**When** one file has an error (malformed syntax)
**Then** only that panel should show an error
**And** other panels should continue functioning normally

**Validation Steps:**
1. Open `tests/fixtures/simple_node3d.tscn` (Panel A - valid)
2. Open `tests/fixtures/malformed_missing_bracket.tscn` (Panel B - invalid)
3. Open `tests/fixtures/empty_scene.tscn` (Panel C - valid)
4. Verify:
   - Panel A shows scene correctly
   - Panel B shows error message
   - Panel C shows empty scene correctly
   - Can interact with Panels A and C normally
   - Error is isolated to Panel B

---

## Expected Panel Behavior

### Panel Lifecycle:
1. **Created**: When TSCN file is opened
2. **Active**: Receives updates when file is saved
3. **Disposed**: When file is closed or VS Code exits

### Panel State:
- Each panel has independent:
  - Three.js scene, camera, renderer
  - Scene tree viewer
  - Node details display
  - Camera orbit controls state

### Panel Identification:
- Title format: `"TSCN Preview: [filename]"` or `"TSCN Preview: [path/filename]"`
- Icon: TSCN file icon
- Closable: Yes
- Movable: Yes (can be dragged to different editor groups)

## Success Criteria

✅ Each TSCN file gets its own independent preview panel
✅ Multiple panels can be open simultaneously without conflicts
✅ Editing one file only updates its corresponding panel
✅ Camera states are independent per panel
✅ Closing panels properly disposes resources
✅ Panels can be arranged in various layouts (side-by-side, grid, etc.)
✅ Performance remains acceptable with multiple panels open
✅ Panel titles clearly identify which file they preview
✅ Memory is properly cleaned up when panels close
✅ Errors in one panel don't affect others
✅ Panels restore correctly after VS Code restart
✅ Same file in multiple editors handled correctly

## Performance Expectations

- Opening new panel: <500ms
- Switching between panels: Instant (no lag)
- Multiple panels (up to 5): No noticeable performance impact
- Memory per panel: Reasonable baseline + scene complexity
- Closing panel: Immediate, cleanup within 10 seconds
