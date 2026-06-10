# Feature: Canvas Rendering

Test the three.js canvas rendering functionality, including scene initialization, object rendering, and visual validation.

## Test Environment

- **Application:** Web Previewer
- **URL:** http://localhost:4173
- **Prerequisites:**
  - Web previewer running
  - Valid TSCN files in `tests/fixtures/`

## Scenarios

### Scenario 1: Canvas Initializes Correctly

**Given** the web previewer is loaded at http://localhost:4173
**Then** the canvas `#canvas` should be present in the DOM
**And** the canvas should have non-zero width and height
**And** the canvas should be visible (not display:none)
**And** the console should have no WebGL errors

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Use `take_snapshot` to capture DOM
3. Verify `#canvas` element exists
4. Use `evaluate_script` to check:
   ```javascript
   const canvas = document.querySelector('#canvas');
   canvas.width > 0 && canvas.height > 0
   ```
5. Use `list_console_messages` to check for WebGL initialization errors

---

### Scenario 2: Scene Renders After File Upload

**Given** the web previewer is loaded
**When** I upload `tests/fixtures/simple_node3d.tscn`
**Then** the canvas should render the scene
**And** the three.js scene should contain Node3D objects
**And** the scene should have lights (ambient + directional)
**And** the scene should have a grid helper
**And** the camera should be positioned at (10, 10, 10)

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Use `evaluate_script` to inspect three.js scene:
   ```javascript
   // Check that scene has objects
   const canvas = document.querySelector('#canvas');
   // Verify renderer is rendering
   // Check scene.children for lights, grid, and nodes
   ({
     hasCanvas: !!canvas,
     sceneExists: window.__tscnScene !== undefined, // if exposed
     renderCount: canvas.width * canvas.height > 0
   })
   ```
4. Take screenshot for visual validation
5. Verify no rendering errors in console

---

### Scenario 3: Visual Snapshot Validation

**Given** the web previewer is loaded
**When** I upload `tests/fixtures/simple_node3d.tscn`
**Then** the canvas should display colored cubes/gizmos
**And** a grid should be visible on the ground plane
**And** the scene should be lit (not completely dark)

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Wait 1 second for rendering to stabilize
4. Use `take_screenshot` to capture canvas
5. Visually inspect screenshot for:
   - Colored cube gizmos (Node3D representations)
   - Grid lines visible
   - Proper lighting (objects not pitch black)

---

### Scenario 4: Multiple Objects Render Correctly

**Given** the web previewer is loaded
**When** I upload `tests/fixtures/large_hierarchy_wide.tscn` (100 children)
**Then** all 100 child nodes should be rendered in the scene
**And** the rendering should complete without performance errors
**And** the canvas should not freeze or become unresponsive

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/large_hierarchy_wide.tscn`
3. Wait for rendering to complete (max 5 seconds)
4. Use `evaluate_script` to count rendered objects:
   ```javascript
   // Count non-light, non-helper objects in scene
   let count = 0;
   // Traverse scene and count nodes
   // This would require accessing the renderer instance
   ```
5. Verify no "script timeout" or performance warnings in console
6. Take screenshot to verify multiple objects visible

---

### Scenario 5: Deep Hierarchy Renders Correctly

**Given** the web previewer is loaded
**When** I upload `tests/fixtures/large_hierarchy_deep.tscn` (16 levels)
**Then** the parent-child transform hierarchy should be preserved
**And** nested objects should have correct world positions
**And** the scene should render without errors

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/large_hierarchy_deep.tscn`
3. Use `evaluate_script` to verify hierarchy is preserved in three.js
4. Verify no console errors related to transform calculations
5. Take screenshot showing the nested structure

---

### Scenario 6: Canvas Resizes Correctly

**Given** the web previewer is loaded
**And** a scene is already rendered
**When** the browser window is resized
**Then** the canvas should resize to fit the new window dimensions
**And** the aspect ratio should update correctly
**And** the scene should continue rendering without distortion

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Use `resize_page` (if available) or `evaluate_script` to trigger resize:
   ```javascript
   window.dispatchEvent(new Event('resize'));
   ```
4. Verify canvas dimensions match window
5. Take screenshot to verify no distortion

---

### Scenario 7: Animation Loop is Running

**Given** the web previewer is loaded
**When** a scene is rendered
**Then** the animation loop should be active
**And** the scene should continuously render (for orbit controls to work)
**And** requestAnimationFrame should be called repeatedly

**Validation Steps:**
1. Navigate to http://localhost:4173
2. Upload `tests/fixtures/simple_node3d.tscn`
3. Use `evaluate_script` to check animation loop:
   ```javascript
   // Set a flag and check if it's being updated
   window.__rafCount = 0;
   const originalRAF = window.requestAnimationFrame;
   window.requestAnimationFrame = function(cb) {
     window.__rafCount++;
     return originalRAF(cb);
   };

   // Wait and check
   setTimeout(() => window.__rafCount, 1000);
   ```
4. Verify RAF count > 0 (animation running)

---

## Expected Canvas State

After loading a valid scene, the canvas should contain:

- **Scene background:** Dark gray (#2a2a2a)
- **Lights:**
  - 1x Ambient light (white, 0.6 intensity)
  - 1x Directional light (white, 0.8 intensity, positioned at 10,10,10)
- **Grid helper:** 20x20 grid on ground plane
- **Node3D gizmos:** Colored cubes (0.5x0.5x0.5) representing each Node3D
- **Camera:** PerspectiveCamera at (10, 10, 10) looking at origin
- **Orbit controls:** Active and responsive

## Success Criteria

✅ Canvas initializes without WebGL errors
✅ Scenes render with correct objects (lights, grid, nodes)
✅ Visual screenshots show expected rendering
✅ Large hierarchies render without performance issues
✅ Parent-child transform hierarchy is preserved
✅ Canvas resizes correctly with window
✅ Animation loop runs continuously
✅ No rendering errors in console
