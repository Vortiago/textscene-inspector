# Feature: Error Handling

Test error handling for malformed TSCN files, invalid content, and edge cases that should trigger error displays.

## Test Environment

- **Application:** Web Previewer
- **URL:** http://localhost:4173
- **Prerequisites:**
  - Web previewer running
  - Malformed test fixtures available

## Scenarios

### Scenario 1: Malformed TSCN File - Missing Bracket

**Given** the web previewer is loaded at http://localhost:4173
**When** I upload `tests/fixtures/malformed_missing_bracket.tscn`
**Then** an error message should be displayed
**And** the error display `#error-display` should have class `visible`
**And** the error message `#error-message` should contain text like "Failed to render TSCN"
**And** the scene info should NOT be visible
**And** a console error should be logged

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/malformed_missing_bracket.tscn`
3. Use `take_snapshot` to capture DOM state
4. Verify `#error-display` has class `visible`
5. Verify `#error-message` textContent contains "Failed to render TSCN"
6. Verify `#scene-info` does NOT have class `visible`
7. Use `list_console_messages` to verify error was logged

---

### Scenario 2: Malformed TSCN File - Invalid Transform

**Given** the web previewer is loaded
**When** I upload `tests/fixtures/malformed_invalid_transform.tscn`
**Then** an error should be displayed OR a warning logged
**And** the error display should become visible
**And** the error message should indicate a parsing failure

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/malformed_invalid_transform.tscn`
3. Use `take_snapshot` to check DOM state
4. Verify error is displayed OR scene loads with fallback transform
5. If error: verify `#error-display` has class `visible`
6. Use `list_console_messages` to check for errors/warnings

---

### Scenario 3: Missing Parent Reference Triggers Warning

**Given** the web previewer is loaded
**When** I upload `tests/fixtures/missing_parent.tscn`
**Then** the scene should load (parent refs are non-fatal)
**And** console warnings should be logged for missing parents
**And** orphaned nodes should be treated as root nodes
**And** no error display should be shown to user

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/missing_parent.tscn`
3. Use `list_console_messages` to find warnings like:
   - "Parent node \"NonExistentParent\" not found for node \"Orphan\""
4. Verify `#error-display` does NOT have class `visible`
5. Verify scene info shows multiple root nodes (Root + orphans)
6. Take screenshot showing scene loaded despite warnings

---

### Scenario 4: Console Errors are Logged

**Given** the web previewer is loaded
**When** I upload a malformed file
**Then** the error should be logged to the console
**And** the error object should be logged with full details
**And** the console log should help with debugging

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/malformed_missing_bracket.tscn`
3. Use `list_console_messages` with filter for 'error' level
4. Verify error message contains useful information:
   - Error type
   - Error message
   - Stack trace (if applicable)

---

### Scenario 5: Error Display is Cleared on Valid Upload

**Given** the web previewer is loaded
**And** an error is currently displayed from a previous malformed upload
**When** I upload a valid file `tests/fixtures/simple_node3d.tscn`
**Then** the error display should be hidden
**And** the scene info should become visible
**And** the scene should render successfully

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/malformed_missing_bracket.tscn` to trigger error
3. Verify error is displayed
4. Upload `tests/fixtures/simple_node3d.tscn`
5. Use `take_snapshot` to verify:
   - `#error-display` does NOT have class `visible`
   - `#scene-info` has class `visible`
6. Verify scene rendered correctly

---

### Scenario 6: Multiple Errors Don't Break UI

**Given** the web previewer is loaded
**When** I upload multiple malformed files in sequence
**Then** each error should be displayed correctly
**And** the error message should update for each file
**And** the UI should remain responsive

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/malformed_missing_bracket.tscn`
3. Verify error is displayed
4. Upload `tests/fixtures/malformed_invalid_transform.tscn`
5. Verify error message updates (or remains displayed)
6. Verify UI is still responsive (can click buttons, upload files)
7. Upload valid file to clear errors
8. Verify recovery is successful

---

### Scenario 7: Empty File Upload

**Given** the web previewer is loaded
**When** I upload `tests/fixtures/empty_scene.tscn` (only header, no nodes)
**Then** the file should parse successfully (empty scene is valid)
**And** no error should be displayed
**And** the scene info should show "Nodes: 0" and "Root: None"

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/empty_scene.tscn`
3. Verify `#error-display` does NOT have class `visible`
4. Verify `#scene-info` has class `visible`
5. Verify `#node-count` shows "Nodes: 0"
6. Verify `#root-node` shows "Root: None"

---

## Expected Error Display Behavior

The error display should:

- Show immediately when an error occurs
- Display a clear, user-friendly error message
- Hide the scene info panel when visible
- Remain visible until a valid file is uploaded
- Be styled clearly (e.g., red background, error icon)
- Not break the page layout

## Expected DOM Structure for Errors

```html
<div id="error-display" class="visible">
  <p id="error-message">Failed to render TSCN: [error details]</p>
</div>
```

## Expected Console Behavior

Console should log:

- **Errors:** Full error objects with stack traces for malformed files
- **Warnings:** Non-fatal issues like missing parent references
- **Info:** Successful parsing and rendering events (optional)

## Types of Errors to Handle

1. **Parse errors:** Invalid TSCN syntax (missing brackets, malformed headings)
2. **Transform errors:** Invalid Transform3D values
3. **Reference errors:** Missing parent nodes (non-fatal warning)
4. **File reading errors:** Empty or corrupted files
5. **Rendering errors:** Issues creating three.js objects

## Success Criteria

✅ Malformed files trigger error display
✅ Error messages are clear and helpful
✅ Console logs provide debugging information
✅ Warnings (like missing parents) don't block scene loading
✅ Error display clears when valid file is uploaded
✅ Multiple errors in sequence are handled gracefully
✅ Empty scenes are treated as valid (no error)
✅ UI remains responsive after errors
