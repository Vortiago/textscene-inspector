# Web App E2E Test Plan: Resource Loading

**Purpose**: Manual end-to-end testing of resource loading in the web application using Chrome DevTools MCP server.

**Prerequisites**:
- Web dev server running: `pnpm --filter @textscene/web-previewer dev` (http://localhost:3000)
- Chrome DevTools MCP server available
- Test texture files created in `test-assets/` directory

**Test Assets Required**:
- `test-assets/test-upload.png` (red texture)
- `test-assets/albedo.png` (green texture)
- `test-assets/normal.png` (normal map blue)
- `test-assets/shared.png` (yellow texture)
- `test-assets/different.png` (magenta texture)

---

## Test Scenario 1: Missing Texture Upload and Update

**Objective**: Verify that uploading a missing texture updates the scene without page reload

### Setup
```javascript
// Open web app
await mcp__chrome_devtools__new_page({ url: 'http://localhost:3000' });

// Take initial snapshot
await mcp__chrome_devtools__take_snapshot();
```

### Test Steps

**Step 1: Load fixture with missing texture**
```javascript
// Click on "Test Missing Texture" fixture
await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const fixtureItem = Array.from(document.querySelectorAll('.fixture-item'))
      .find(el => el.textContent.trim() === 'Test Missing Texture');
    if (fixtureItem) {
      fixtureItem.click();
      return { success: true };
    }
    return { success: false, error: 'Fixture not found' };
  }`
});

// Wait for scene to load
await new Promise(resolve => setTimeout(resolve, 1000));
```

**Step 2: Verify initial state**
```javascript
// Take snapshot to verify UI
const snapshot = await mcp__chrome_devtools__take_snapshot();
// Expected: Mesh visible with white fallback material
// Expected: Missing resources panel shows 'textures/test-upload.png'

// Check console for warnings
const consoleMessages = await mcp__chrome_devtools__list_console_messages({
  types: ['warn', 'error']
});
// Expected: Warning about missing texture
```

**Step 3: Check missing resources UI**
```javascript
const uiState = await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const resourceFilesList = document.getElementById('resource-files-list');
    const missingItems = resourceFilesList ?
      Array.from(resourceFilesList.querySelectorAll('.resource-file-item.missing')) : [];

    return {
      panelVisible: !!resourceFilesList && resourceFilesList.children.length > 0,
      missingCount: missingItems.length,
      missingPaths: missingItems.map(item =>
        item.querySelector('.resource-file-path')?.textContent
      )
    };
  }`
});

// Expected: panelVisible: true
// Expected: missingCount: 1
// Expected: missingPaths: ['res://textures/test-upload.png']
```

**Step 4: Upload texture file**
```javascript
// Find upload input for the missing resource
const uploadResult = await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const resourceFilesList = document.getElementById('resource-files-list');
    const missingItems = Array.from(resourceFilesList.querySelectorAll('.resource-file-item.missing'));
    const firstMissing = missingItems[0];
    const uploadInput = firstMissing?.querySelector('input[type="file"]');

    if (uploadInput) {
      return {
        found: true,
        uid: uploadInput.getAttribute('data-uid') || 'upload-input-1'
      };
    }
    return { found: false };
  }`
});

// Upload file using Chrome DevTools MCP
await mcp__chrome_devtools__upload_file({
  uid: uploadResult.uid, // Or find the input element
  filePath: 'D:/CodeRepos/Text-Scene-.tscn-File-Previewer/test-assets/test-upload.png'
});
```

**Step 5: Verify scene updated**
```javascript
// Wait for update
await new Promise(resolve => setTimeout(resolve, 1000));

// Check console for resource loaded message
const consoleAfter = await mcp__chrome_devtools__list_console_messages({
  types: ['info']
});
// Expected: Log showing resource provided/loaded

// Take screenshot to verify texture applied
await mcp__chrome_devtools__take_screenshot({
  filePath: './test-results/scenario1-after-upload.png'
});

// Verify missing resources list empty
const finalState = await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const resourceFilesList = document.getElementById('resource-files-list');
    const missingItems = resourceFilesList ?
      Array.from(resourceFilesList.querySelectorAll('.resource-file-item.missing')) : [];
    const uploadedItems = resourceFilesList ?
      Array.from(resourceFilesList.querySelectorAll('.resource-file-item.uploaded')) : [];

    return {
      missingCount: missingItems.length,
      uploadedCount: uploadedItems.length
    };
  }`
});

// Expected: missingCount: 0
// Expected: uploadedCount: 1 (the uploaded texture)
```

### Pass Criteria
- ✅ Missing resource appears in Resource Files panel
- ✅ Console warning logged for missing texture
- ✅ Upload input available for missing resource
- ✅ After upload, scene re-renders without page reload
- ✅ Missing resource removed from list
- ✅ Uploaded resource appears with green checkmark

---

## Test Scenario 2: Missing Material with Multiple Textures

**Objective**: Verify material with texture dependencies loads correctly when provided

### Setup
```javascript
// Navigate to page (if not already loaded)
await mcp__chrome_devtools__navigate_page({
  type: 'url',
  url: 'http://localhost:3000'
});
```

### Test Steps

**Step 1: Load fixture with missing material**
```javascript
await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const fixtureItem = Array.from(document.querySelectorAll('.fixture-item'))
      .find(el => el.textContent.trim() === 'Test Missing Material');
    fixtureItem?.click();
  }`
});

await new Promise(resolve => setTimeout(resolve, 1000));
```

**Step 2: Verify THREE missing resources**
```javascript
const missingState = await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const resourceFilesList = document.getElementById('resource-files-list');
    const missingItems = Array.from(resourceFilesList.querySelectorAll('.resource-file-item.missing'));

    return {
      count: missingItems.length,
      paths: missingItems.map(item =>
        item.querySelector('.resource-file-path')?.textContent
      )
    };
  }`
});

// Expected: count: 3
// Expected: paths includes 'materials/test.tres', 'textures/albedo.png', 'textures/normal.png'
```

**Step 3: Upload textures first (should NOT update mesh yet)**
```javascript
// Upload albedo texture
await mcp__chrome_devtools__upload_file({
  uid: 'albedo-upload-input',
  filePath: 'D:/CodeRepos/Text-Scene-.tscn-File-Previewer/test-assets/albedo.png'
});

await new Promise(resolve => setTimeout(resolve, 500));

// Upload normal texture
await mcp__chrome_devtools__upload_file({
  uid: 'normal-upload-input',
  filePath: 'D:/CodeRepos/Text-Scene-.tscn-File-Previewer/test-assets/normal.png'
});

await new Promise(resolve => setTimeout(resolve, 500));

// Take screenshot - mesh should still have fallback material
await mcp__chrome_devtools__take_screenshot({
  filePath: './test-results/scenario2-textures-only.png'
});
```

**Step 4: Upload material file (should NOW update mesh)**
```javascript
await mcp__chrome_devtools__upload_file({
  uid: 'material-upload-input',
  filePath: 'D:/CodeRepos/Text-Scene-.tscn-File-Previewer/scenes/fixtures/materials/test.tres'
});

await new Promise(resolve => setTimeout(resolve, 1000));

// Take screenshot - mesh should now show material with both textures
await mcp__chrome_devtools__take_screenshot({
  filePath: './test-results/scenario2-material-applied.png'
});
```

**Step 5: Verify all resources cleared from missing list**
```javascript
const finalState = await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const resourceFilesList = document.getElementById('resource-files-list');
    const missingItems = resourceFilesList ?
      Array.from(resourceFilesList.querySelectorAll('.resource-file-item.missing')) : [];

    return {
      missingCount: missingItems.length
    };
  }`
});

// Expected: missingCount: 0
```

### Pass Criteria
- ✅ All 3 dependencies (material + 2 textures) tracked as missing
- ✅ Uploading textures alone does NOT trigger mesh update
- ✅ Uploading material triggers full resolution chain
- ✅ Final scene shows material with both albedo and normal map
- ✅ Missing resources list empty after all uploads

---

## Test Scenario 3: External Scene Upload

**Objective**: Verify external scene nodes appear in tree when provided

### Test Steps

**Step 1: Load fixture with missing external scene**
```javascript
await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const fixtureItem = Array.from(document.querySelectorAll('.fixture-item'))
      .find(el => el.textContent.trim() === 'Test Missing External Scene');
    fixtureItem?.click();
  }`
});

await new Promise(resolve => setTimeout(resolve, 1000));
```

**Step 2: Verify tree shows placeholder**
```javascript
const treeState = await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const treeViewer = document.querySelector('.scene-tree-viewer');
    const treeHTML = treeViewer?.innerHTML || '';

    // Count tree nodes
    const nodeItems = Array.from(document.querySelectorAll('.tree-node'));

    return {
      nodeCount: nodeItems.length,
      hasExternalNodePlaceholder: nodeItems.some(node =>
        node.textContent.includes('ExternalNode')
      ),
      hasChildNodes: nodeItems.some(node =>
        node.textContent.includes('Child') || node.textContent.includes('ChildMesh')
      )
    };
  }`
});

// Expected: hasExternalNodePlaceholder: true
// Expected: hasChildNodes: false (children not loaded yet)
```

**Step 3: Upload external scene**
```javascript
await mcp__chrome_devtools__upload_file({
  uid: 'external-scene-upload-input',
  filePath: 'D:/CodeRepos/Text-Scene-.tscn-File-Previewer/scenes/fixtures/subscenes/child.tscn'
});

await new Promise(resolve => setTimeout(resolve, 1000));
```

**Step 4: Verify tree updated with child nodes**
```javascript
const updatedTreeState = await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const nodeItems = Array.from(document.querySelectorAll('.tree-node'));

    return {
      nodeCount: nodeItems.length,
      hasChildNodes: nodeItems.some(node =>
        node.textContent.includes('Child') || node.textContent.includes('ChildMesh')
      ),
      nodeNames: nodeItems.map(node =>
        node.querySelector('.node-name')?.textContent
      )
    };
  }`
});

// Expected: hasChildNodes: true
// Expected: nodeCount increased (includes Child and ChildMesh)
```

### Pass Criteria
- ✅ External scene tracked as missing resource
- ✅ Tree shows parent node but no children initially
- ✅ Upload triggers scene loading
- ✅ Tree updates to show child nodes from external scene
- ✅ Node lifecycle events reflected in tree UI

---

## Test Scenario 4: Performance - Multiple Meshes, Single Texture

**Objective**: Document current update behavior (updates all meshes vs. only affected ones)

### Test Steps

**Step 1: Load fixture with 3 meshes (2 share texture, 1 different)**
```javascript
await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const fixtureItem = Array.from(document.querySelectorAll('.fixture-item'))
      .find(el => el.textContent.trim() === 'Test Multiple Meshes Shared Texture');
    fixtureItem?.click();
  }`
});

await new Promise(resolve => setTimeout(resolve, 1000));
```

**Step 2: Clear console and track update logs**
```javascript
// Clear console
await mcp__chrome_devtools__evaluate_script({
  function: `() => { console.clear(); }`
});

// Note starting message count
const beforeCount = (await mcp__chrome_devtools__list_console_messages({ types: ['info'] })).length;
```

**Step 3: Upload shared texture**
```javascript
await mcp__chrome_devtools__upload_file({
  uid: 'shared-texture-upload-input',
  filePath: 'D:/CodeRepos/Text-Scene-.tscn-File-Previewer/test-assets/shared.png'
});

await new Promise(resolve => setTimeout(resolve, 1000));
```

**Step 4: Count update operations**
```javascript
const afterCount = (await mcp__chrome_devtools__list_console_messages({ types: ['info'] })).length;
const updateLogs = await mcp__chrome_devtools__list_console_messages({
  types: ['info'],
  pageIdx: 0,
  pageSize: 100
});

// Filter for node update logs
const nodeUpdateLogs = updateLogs.filter(log =>
  log.message.includes('update') || log.message.includes('Node')
);

console.log('Node update logs:', nodeUpdateLogs);
console.log('Total update count:', nodeUpdateLogs.length);
```

**Expected Behavior (Current)**:
- All 3 MeshInstance3D nodes updated
- Console shows 3 update operations
- ⚠️ **Performance Issue**: Mesh3 updated even though it doesn't use the shared texture

**Desired Behavior (Future)**:
- Only Mesh1 and Mesh2 updated (use shared texture)
- Console shows 2 update operations
- Mesh3 not touched (uses different texture)

### Pass Criteria
- ✅ Visual result correct (2 meshes show shared texture, 1 unchanged)
- ⚠️ **Document**: Current behavior updates all 3 meshes (inefficient)
- ⚠️ **Document**: Console logs reveal 3 updates instead of 2

**Note**: This test documents current behavior for future optimization work (see resource-loading-findings.md for details).

---

## Test Scenario 5: Rapid Fixture Switching (Race Condition Test)

**Objective**: Verify no race conditions when quickly switching fixtures

### Test Steps

**Step 1: Load first fixture**
```javascript
await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const fixtureItem = Array.from(document.querySelectorAll('.fixture-item'))
      .find(el => el.textContent.trim() === 'Test Missing Texture');
    fixtureItem?.click();
  }`
});

// Don't wait - immediately switch to second fixture
```

**Step 2: Immediately load second fixture**
```javascript
await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const fixtureItem = Array.from(document.querySelectorAll('.fixture-item'))
      .find(el => el.textContent.trim() === 'Test Missing Material');
    fixtureItem?.click();
  }`
});

await new Promise(resolve => setTimeout(resolve, 2000));
```

**Step 3: Verify correct fixture loaded**
```javascript
const sceneState = await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const resourceFilesList = document.getElementById('resource-files-list');
    const missingItems = resourceFilesList ?
      Array.from(resourceFilesList.querySelectorAll('.resource-file-item.missing')) : [];

    return {
      missingPaths: missingItems.map(item =>
        item.querySelector('.resource-file-path')?.textContent
      )
    };
  }`
});

// Expected: missingPaths contains 'materials/test.tres' (from second fixture)
// Expected: NOT 'textures/test-upload.png' (from first fixture)
```

**Step 4: Check console for abort messages**
```javascript
const consoleLogs = await mcp__chrome_devtools__list_console_messages({
  types: ['info']
});

// Expected: Log showing first fixture load aborted
// Example: "Fixture load aborted (user clicked another fixture)"
```

### Pass Criteria
- ✅ First fixture load aborted cleanly
- ✅ Second fixture loads successfully
- ✅ No lingering state from first fixture
- ✅ Missing resources list matches second fixture only
- ✅ No errors in console

---

## Test Scenario 6: Visual Regression (Screenshot Comparison)

**Objective**: Capture screenshots for visual regression testing

### Test Steps

**Before upload:**
```javascript
// Load fixture
await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    document.querySelector('[data-fixture="test-missing-texture.tscn"]')?.click();
  }`
});

await new Promise(resolve => setTimeout(resolve, 1000));

// Take screenshot
await mcp__chrome_devtools__take_screenshot({
  filePath: './test-results/visual-before-texture.png',
  fullPage: false
});
```

**After upload:**
```javascript
// Upload texture
// ... (upload steps from Scenario 1)

await new Promise(resolve => setTimeout(resolve, 1000));

// Take screenshot
await mcp__chrome_devtools__take_screenshot({
  filePath: './test-results/visual-after-texture.png',
  fullPage: false
});
```

**Manual Comparison:**
- Compare before/after screenshots
- Verify mesh appearance changed (white → textured)
- Verify UI state changed (missing → uploaded)

### Pass Criteria
- ✅ Screenshots captured successfully
- ✅ Visual difference visible between before/after
- ✅ No visual glitches or rendering errors

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Start web dev server: `pnpm --filter @textscene/web-previewer dev`
- [ ] Verify server running at http://localhost:3000
- [ ] Create test-assets directory with required texture files
- [ ] Open Chrome DevTools MCP connection
- [ ] Create test-results directory for screenshots

### Test Execution
- [ ] Run Scenario 1: Missing Texture Upload
- [ ] Run Scenario 2: Missing Material with Multiple Textures
- [ ] Run Scenario 3: External Scene Upload
- [ ] Run Scenario 4: Performance - Multiple Meshes
- [ ] Run Scenario 5: Rapid Fixture Switching
- [ ] Run Scenario 6: Visual Regression

### Post-Test Validation
- [ ] Review all console logs for errors
- [ ] Review network requests for failed loads
- [ ] Review screenshots for visual correctness
- [ ] Document any failures or unexpected behavior
- [ ] Compare results with expected behavior in each scenario

---

## Troubleshooting

### Missing Resources Not Appearing in UI
**Issue**: Resource Files panel empty even when resources are missing
**Debug**:
```javascript
await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    // Check if updateResourceFilesList is being called
    console.log('Resource files list:', document.getElementById('resource-files-list'));
    console.log('Children count:', document.getElementById('resource-files-list')?.children.length);
  }`
});
```

### Upload Input Not Found
**Issue**: Cannot find upload input for missing resource
**Debug**:
```javascript
await mcp__chrome_devtools__evaluate_script({
  function: `() => {
    const resourceFilesList = document.getElementById('resource-files-list');
    const allInputs = resourceFilesList?.querySelectorAll('input[type="file"]');
    console.log('Upload inputs found:', allInputs?.length);
  }`
});
```

### Scene Not Updating After Upload
**Issue**: Resource uploaded but scene doesn't re-render
**Debug**:
```javascript
// Check console for error messages
const errors = await mcp__chrome_devtools__list_console_messages({
  types: ['error']
});

// Check network requests for resource loading
const networkRequests = await mcp__chrome_devtools__list_network_requests({
  resourceTypes: ['xhr', 'fetch', 'other']
});
```

---

## Expected Results Summary

| Scenario | Key Verification | Current Behavior | Notes |
|----------|------------------|------------------|-------|
| 1. Missing Texture | Scene updates after upload | ✅ Works | Core functionality |
| 2. Missing Material | Dependencies resolved correctly | ✅ Works | Multi-resource flow |
| 3. External Scene | Tree updates with child nodes | ✅ Works | Scene composition |
| 4. Performance | Only affected nodes update | ⚠️ All nodes update | Optimization opportunity |
| 5. Rapid Switching | No race conditions | ✅ Works | AbortController pattern |
| 6. Visual Regression | Screenshots match expected | ✅ Manual check | Baseline needed |

---

## Next Steps

After completing these tests:
1. Document results in test-results/report.md
2. File issues for any failures
3. Update resource-loading-findings.md with new insights
4. Consider automating high-value tests
5. Create baseline screenshots for visual regression

---

## Notes

- All tests should be run with a clean browser state (no cached resources)
- Tests assume standard 1920x1080 viewport
- Console logs are verbose by default (useful for debugging)
- Missing resources may not display in UI (known issue, see findings document)
- Performance test (Scenario 4) documents current inefficiency for future optimization
