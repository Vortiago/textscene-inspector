# Feature: File Upload

Test the file upload functionality of the TSCN web previewer, including valid file uploads, empty files, and invalid file formats.

## Test Environment

- **Application:** Web Previewer
- **URL:** http://localhost:4173
- **Prerequisites:**
  - Web previewer must be running (`pnpm preview` in apps/textscene-web)
  - Test fixtures available in `tests/fixtures/`

## Scenarios

### Scenario 1: Upload Valid TSCN File

**Given** the web previewer is loaded at http://localhost:4173
**When** I upload the file `tests/fixtures/simple_node3d.tscn` using the file input `#file-upload`
**Then** the canvas `#canvas` should be visible
**And** the scene info `#scene-info` should have class `visible`
**And** the node count `#node-count` should display "Nodes: 4"
**And** the root node `#root-node` should display "Root: Root"
**And** the error display `#error-display` should NOT have class `visible`
**And** the console should have no errors

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Use `upload_file` to upload `tests/fixtures/simple_node3d.tscn` to `#file-upload`
3. Use `take_snapshot` to capture DOM state
4. Verify `#scene-info` has class `visible`
5. Verify `#node-count` textContent is "Nodes: 4"
6. Verify `#root-node` textContent is "Root: Root"
7. Verify `#error-display` does NOT have class `visible`
8. Use `list_console_messages` to check for errors

---

### Scenario 2: Upload Empty TSCN File

**Given** the web previewer is loaded
**When** I upload the file `tests/fixtures/empty_scene.tscn`
**Then** the scene info should show "Nodes: 0"
**And** the root node should display "Root: None"
**And** the canvas should still be visible
**And** no errors should be displayed

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/empty_scene.tscn` to `#file-upload`
3. Use `take_snapshot` to verify DOM state
4. Verify `#node-count` textContent is "Nodes: 0"
5. Verify `#root-node` textContent is "Root: None"
6. Verify `#error-display` does NOT have class `visible`

---

### Scenario 3: Upload File with Complex Hierarchy

**Given** the web previewer is loaded
**When** I upload the file `tests/fixtures/large_hierarchy_wide.tscn` (100 sibling nodes)
**Then** the scene should load successfully
**And** the node count should display "Nodes: 101" (1 root + 100 children)
**And** the canvas should render without console errors
**And** the scene info should be visible

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/large_hierarchy_wide.tscn`
3. Wait for parsing and rendering to complete
4. Verify `#node-count` textContent is "Nodes: 101"
5. Verify `#scene-info` has class `visible`
6. Use `list_console_messages` to ensure no errors

---

### Scenario 4: Upload Deep Hierarchy File

**Given** the web previewer is loaded
**When** I upload the file `tests/fixtures/large_hierarchy_deep.tscn` (16 levels deep)
**Then** the scene should load successfully
**And** the node count should display "Nodes: 16"
**And** no errors should occur during rendering
**And** the scene info should show proper root node name "Root: Level0"

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/large_hierarchy_deep.tscn`
3. Verify `#node-count` textContent is "Nodes: 16"
4. Verify `#root-node` textContent is "Root: Level0"
5. Use `list_console_messages` to check for warnings or errors

---

### Scenario 5: Sequential File Uploads

**Given** the web previewer is loaded
**And** I have already uploaded `tests/fixtures/simple_node3d.tscn`
**When** I upload a different file `tests/fixtures/empty_scene.tscn`
**Then** the previous scene should be replaced
**And** the scene info should update to show "Nodes: 0"
**And** the root node should change to "Root: None"
**And** the canvas should clear the previous scene objects

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Verify initial state (Nodes: 4, Root: Root)
4. Upload `tests/fixtures/empty_scene.tscn`
5. Verify updated state (Nodes: 0, Root: None)
6. Use `evaluate_script` to check that three.js scene has been updated
7. Ensure no duplicate objects from previous scene remain

---

## Expected DOM Structure

```html
<input type="file" id="file-upload" accept=".tscn" />
<canvas id="canvas"></canvas>
<div id="error-display" class="[visible|hidden]">
  <p id="error-message"></p>
</div>
<div id="scene-info" class="[visible|hidden]">
  <p id="node-count">Nodes: X</p>
  <p id="root-node">Root: [name]</p>
</div>
```

## Success Criteria

✅ Valid TSCN files upload and parse successfully
✅ Scene info displays accurate node count and root name
✅ Empty scenes are handled gracefully
✅ Large hierarchies (wide and deep) render without errors
✅ Sequential uploads replace previous scenes correctly
✅ No console errors during file processing
✅ UI state updates reflect the loaded scene
