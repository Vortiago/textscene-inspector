# Feature: UI State Management

Test the UI state transitions and display behavior, including scene info visibility, node counting, and responsive layout.

## Test Environment

- **Application:** Web Previewer
- **URL:** http://localhost:4173
- **Prerequisites:**
  - Web previewer running
  - Test fixtures available

## Scenarios

### Scenario 1: Initial UI State

**Given** the web previewer is loaded at http://localhost:4173
**Then** the scene info `#scene-info` should NOT have class `visible`
**And** the error display `#error-display` should NOT have class `visible`
**And** the canvas `#canvas` should be visible
**And** the file upload input `#file-upload` should be visible
**And** the reset camera button `#reset-camera` should be visible

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Use `take_snapshot` to capture initial DOM state
3. Verify `#scene-info` does NOT have class `visible`
4. Verify `#error-display` does NOT have class `visible`
5. Verify `#canvas`, `#file-upload`, and `#reset-camera` are visible
6. Take screenshot showing clean initial state

---

### Scenario 2: Scene Info Appears After Upload

**Given** the web previewer is loaded
**When** I upload `tests/fixtures/simple_node3d.tscn`
**Then** the scene info `#scene-info` should become visible (add class `visible`)
**And** the node count `#node-count` should display "Nodes: 4"
**And** the root node `#root-node` should display "Root: Root"

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Use `take_snapshot` to verify DOM updates
4. Verify `#scene-info` has class `visible`
5. Verify `#node-count` textContent is exactly "Nodes: 4"
6. Verify `#root-node` textContent is exactly "Root: Root"

---

### Scenario 3: Node Count Updates Correctly

**Given** the web previewer is loaded
**When** I upload different files with varying node counts
**Then** the node count should update accurately for each file

**Test Cases:**
- `simple_node3d.tscn` → "Nodes: 4" (1 root + 3 children)
- `empty_scene.tscn` → "Nodes: 0"
- `large_hierarchy_wide.tscn` → "Nodes: 101" (1 root + 100 children)
- `large_hierarchy_deep.tscn` → "Nodes: 16"

**Validation Steps:**
1. Navigate to http://localhost:4173
2. For each file:
   a. Upload the file
   b. Verify `#node-count` shows correct count
   c. Take snapshot to record state

---

### Scenario 4: Root Node Name Updates

**Given** the web previewer is loaded
**When** I upload files with different root node names
**Then** the root node display should update to show the correct name

**Test Cases:**
- `simple_node3d.tscn` → "Root: Root"
- `empty_scene.tscn` → "Root: None"
- `large_hierarchy_deep.tscn` → "Root: Level0"

**Validation Steps:**
1. Navigate to http://localhost:4173
2. For each file:
   a. Upload the file
   b. Verify `#root-node` shows correct name
   c. Take snapshot

---

### Scenario 5: Error State Hides Scene Info

**Given** the web previewer is loaded
**And** scene info is visible from a previous successful upload
**When** I upload a malformed file `tests/fixtures/malformed_missing_bracket.tscn`
**Then** the error display `#error-display` should become visible
**And** the scene info `#scene-info` should become hidden (remove class `visible`)

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn` (scene info visible)
3. Verify `#scene-info` has class `visible`
4. Upload `tests/fixtures/malformed_missing_bracket.tscn`
5. Verify `#error-display` has class `visible`
6. Verify `#scene-info` does NOT have class `visible`

---

### Scenario 6: Success State Hides Error Display

**Given** the web previewer is loaded
**And** an error is currently displayed
**When** I upload a valid file
**Then** the error display should be hidden
**And** the scene info should become visible

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/malformed_missing_bracket.tscn` (error visible)
3. Verify `#error-display` has class `visible`
4. Upload `tests/fixtures/simple_node3d.tscn`
5. Verify `#error-display` does NOT have class `visible`
6. Verify `#scene-info` has class `visible`

---

### Scenario 7: Scene Info Updates on Sequential Uploads

**Given** the web previewer is loaded
**When** I upload multiple valid files in sequence
**Then** the scene info should update for each file
**And** the previous scene's info should be replaced

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
   - Verify "Nodes: 4", "Root: Root"
3. Upload `tests/fixtures/empty_scene.tscn`
   - Verify "Nodes: 0", "Root: None"
4. Upload `tests/fixtures/large_hierarchy_wide.tscn`
   - Verify "Nodes: 101", "Root: Root"
5. Verify each transition updates correctly without stale data

---

### Scenario 8: Layout Remains Stable

**Given** the web previewer is loaded
**When** I perform various operations (upload, reset, errors)
**Then** the page layout should remain stable
**And** elements should not overlap or disappear unexpectedly
**And** the canvas should remain the primary visual element

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Take initial screenshot
3. Upload valid file → take screenshot
4. Upload malformed file → take screenshot
5. Upload valid file again → take screenshot
6. Click reset button → take screenshot
7. Compare all screenshots to verify:
   - Canvas always visible
   - Controls always accessible
   - No layout shifts or overlaps
   - Consistent positioning

---

### Scenario 9: Scene Info Contains Expected Elements

**Given** scene info is visible
**Then** it should contain both node count and root node elements
**And** both elements should have appropriate IDs
**And** the text should be formatted consistently

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Use `take_snapshot` to inspect scene info structure
4. Verify `#scene-info` contains:
   - `#node-count` element
   - `#root-node` element
5. Verify text format: "Nodes: X" and "Root: [name]"

---

## Expected UI States

### State 1: Initial (Empty)
- ❌ Scene info hidden
- ❌ Error display hidden
- ✅ Canvas visible
- ✅ File upload visible
- ✅ Reset button visible

### State 2: Scene Loaded (Success)
- ✅ Scene info visible
- ❌ Error display hidden
- ✅ Canvas visible with rendered scene
- ✅ All controls visible

### State 3: Error Occurred
- ❌ Scene info hidden
- ✅ Error display visible
- ✅ Canvas visible (may be empty)
- ✅ All controls visible

## Expected DOM Structure

```html
<div class="app-container">
  <input type="file" id="file-upload" accept=".tscn" />
  <button id="reset-camera">Reset Camera</button>

  <canvas id="canvas"></canvas>

  <div id="error-display" class="[visible|hidden]">
    <p id="error-message">[error text]</p>
  </div>

  <div id="scene-info" class="[visible|hidden]">
    <p id="node-count">Nodes: X</p>
    <p id="root-node">Root: [name]</p>
  </div>
</div>
```

## CSS Classes

- `.visible` - Applied to show error-display or scene-info
- Absence of `.visible` - Element is hidden

## Success Criteria

✅ Initial state shows no info/error panels
✅ Scene info appears after successful file upload
✅ Node count updates accurately for all test cases
✅ Root node name displays correctly
✅ Error state hides scene info
✅ Success state hides error display
✅ Sequential uploads update info correctly
✅ Layout remains stable through all state transitions
✅ UI elements maintain consistent positioning
