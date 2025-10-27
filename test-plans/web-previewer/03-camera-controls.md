# Feature: Camera Controls

Test the camera control functionality including the reset button and orbit controls for navigating the 3D scene.

## Test Environment

- **Application:** Web Previewer
- **URL:** http://localhost:4173
- **Prerequisites:**
  - Web previewer running
  - Valid TSCN file to load

## Scenarios

### Scenario 1: Reset Camera Button Exists

**Given** the web previewer is loaded at http://localhost:4173
**Then** the reset camera button `#reset-camera` should be present in the DOM
**And** the button should be visible
**And** the button should be clickable

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Use `take_snapshot` to verify DOM structure
3. Verify element `#reset-camera` exists
4. Verify button is not disabled
5. Verify button has appropriate text (e.g., "Reset Camera")

---

### Scenario 2: Camera Starts at Default Position

**Given** the web previewer is loaded
**When** I upload `tests/fixtures/simple_node3d.tscn`
**Then** the camera should be positioned at (10, 10, 10)
**And** the camera should be looking at the origin (0, 0, 0)
**And** the camera FOV should be 75 degrees

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Use `evaluate_script` to check camera position:
   ```javascript
   // Access camera from renderer (if exposed globally or via debug)
   ({
     cameraExists: true, // Verify camera is initialized
     // Check default position if accessible
   })
   ```
4. Take screenshot showing default view angle

---

### Scenario 3: Reset Camera Restores Default Position

**Given** the web previewer is loaded
**And** a scene is rendered from `tests/fixtures/simple_node3d.tscn`
**And** the camera has been moved (simulated by orbit controls interaction)
**When** I click the reset camera button `#reset-camera`
**Then** the camera should return to position (10, 10, 10)
**And** the camera should look at the origin again
**And** the orbit controls should be reset

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Simulate camera movement (if possible via evaluate_script):
   ```javascript
   // Move camera to different position
   // This would require accessing the renderer instance
   ```
4. Use `click` on `#reset-camera` button
5. Use `evaluate_script` to verify camera returned to (10, 10, 10)
6. Take screenshot showing reset view

---

### Scenario 4: Reset Button Works After Multiple Uses

**Given** the web previewer is loaded
**And** a scene is rendered
**When** I click the reset button multiple times
**Then** each click should reset the camera to the default position
**And** no errors should occur
**And** the button should remain responsive

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Click `#reset-camera` 5 times in succession
4. Use `list_console_messages` to check for errors
5. Verify button still responds to clicks
6. Take screenshot showing stable view

---

### Scenario 5: Orbit Controls are Active

**Given** the web previewer is loaded
**And** a scene is rendered from `tests/fixtures/simple_node3d.tscn`
**Then** orbit controls should be enabled
**And** the controls should have damping enabled
**And** the damping factor should be 0.05

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Use `evaluate_script` to check orbit controls configuration:
   ```javascript
   // Access controls from renderer (if exposed)
   ({
     controlsEnabled: true,
     dampingEnabled: true,
     dampingFactor: 0.05
   })
   ```

---

### Scenario 6: Canvas Responds to Mouse Interaction

**Given** the web previewer is loaded
**And** a scene is rendered
**When** I simulate mouse drag on the canvas
**Then** the camera view should change (orbit controls working)
**And** the scene should continue rendering smoothly

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Use `hover` and `drag` (if available) on `#canvas` to simulate mouse interaction
4. Take screenshot before interaction
5. Perform drag operation
6. Take screenshot after interaction
7. Compare screenshots to verify view changed
8. Use `list_console_messages` to ensure no errors during interaction

---

### Scenario 7: Reset Works After Scene Change

**Given** the web previewer is loaded
**And** I have uploaded and navigated a scene
**When** I upload a different scene
**And** click the reset button
**Then** the camera should reset to the default position for the new scene
**And** the previous camera state should be cleared

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Click `#reset-camera` to ensure it works
4. Upload `tests/fixtures/empty_scene.tscn`
5. Click `#reset-camera` again
6. Verify camera is at default position (10, 10, 10)
7. Take screenshot showing proper reset after scene change

---

## Expected Button Behavior

The reset camera button should:

- Be visible and accessible at all times
- Display clear text (e.g., "Reset Camera" or "🔄 Reset Camera")
- Respond immediately to clicks
- Not cause page reloads or navigation
- Work consistently across multiple scenes
- Provide visual feedback on click (if styled with hover/active states)

## Expected Camera Configuration

- **Type:** THREE.PerspectiveCamera
- **Position:** (10, 10, 10)
- **Look At:** (0, 0, 0)
- **FOV:** 75 degrees
- **Near plane:** 0.1
- **Far plane:** 1000
- **Aspect ratio:** Matches canvas dimensions

## Expected Orbit Controls Configuration

- **Enable damping:** true
- **Damping factor:** 0.05
- **Target:** (0, 0, 0)
- **Enabled:** true

## Success Criteria

✅ Reset camera button is present and functional
✅ Camera starts at default position (10, 10, 10)
✅ Reset button restores camera to default position
✅ Reset works correctly after multiple clicks
✅ Orbit controls are active and configured correctly
✅ Canvas responds to mouse interactions
✅ Reset works after changing scenes
✅ No console errors during camera operations
