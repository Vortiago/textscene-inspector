# WI-57 Implementation Plan - WorldEnvironment + Environment SubResource

**Status**: In Progress
**Started**: 2025-11-10
**Estimated Completion**: 6.5 hours

---

## 🎯 Working Principles (CLAUDE.md)

### Test-As-You-Go (CRITICAL)
- ❌ **Bad**: Write lots of code → Run checks → Fix errors
- ✅ **Good**: Write small piece → Run checks → Next piece

### Development Cycle
1. Write a small change (single function, single file)
2. Build immediately: `pnpm --filter @textscene/core build`
3. Type check immediately: `pnpm type-check`
4. If types fail, fix NOW (while context is fresh)
5. Write tests for the change
6. Run tests: `pnpm test`
7. Repeat for next small change

### Quality Standards
- ✅ NO placeholders or TODO comments
- ✅ NO stubs - complete implementation only
- ✅ Every public method has minimum 3 tests (happy, error, edge)
- ✅ Build and type-check after EVERY file
- ✅ Run tests immediately after writing them
- ✅ Minimum 3 tests per public method

### Fixture Requirements
- ✅ Every implemented feature MUST have a fixture
- ✅ Create multiple fixtures for different scenarios
- ✅ Lint fixtures before committing (zero errors)
- ✅ Visual verification in web previewer required

---

## 📋 Implementation Phases

### ✅ Phase 0: Research Complete
- [x] Validated Godot Environment properties from GitHub
- [x] Validated WorldEnvironment class structure
- [x] Confirmed background mode enum values
- [x] Confirmed fog properties (albedo exists!)
- [x] Created WI-77 for deferred features

---

### Phase 1: Environment SubResource (2 hours)

#### 1.1: Types & Parser (45 min)
- [ ] Create `packages/textscene-core/src/resources/environment/types.ts`
  - BackgroundMode enum (0-5)
  - EnvironmentProperties interface
- [ ] Create `packages/textscene-core/src/resources/environment/parser.ts`
  - parseEnvironment() function
  - Use parseColor from StandardMaterial3D
  - Handle all defaults
- [ ] Create `packages/textscene-core/src/resources/environment/parser.test.ts`
  - Test default environment (all defaults)
  - Test BG_COLOR mode with custom color
  - Test volumetric fog settings
  - Test adjustment settings
  - Test SSR flag
  - **MINIMUM 5 tests**
- [ ] **Immediate**: `pnpm --filter @textscene/core build`
- [ ] **Immediate**: `pnpm type-check`
- [ ] **Immediate**: `pnpm --filter @textscene/core test parser.test.ts`
- [ ] Fix any errors before proceeding

#### 1.2: Renderer (30 min)
- [ ] Create `packages/textscene-core/src/resources/environment/renderer.ts`
  - EnvironmentSettings interface
  - createEnvironmentSettings() function
  - Return structured settings object
- [ ] Create `packages/textscene-core/src/resources/environment/renderer.test.ts`
  - Test background only settings
  - Test fog enabled settings
  - Test adjustments enabled settings
  - Test SSR enabled settings
  - **MINIMUM 4 tests**
- [ ] **Immediate**: `pnpm type-check`
- [ ] **Immediate**: `pnpm --filter @textscene/core test renderer.test.ts`
- [ ] Fix any errors before proceeding

#### 1.3: Linter (45 min)
- [ ] Create `packages/textscene-core/src/resources/environment/linterParser.ts`
  - Register validators for all properties
  - Reuse validateBoolean, validateColor from StandardMaterial3D
  - Validate background_mode range (0-5)
  - Validate density >= 0
  - Validate brightness/contrast/saturation >= 0
- [ ] Create `packages/textscene-core/src/resources/environment/linter.ts`
  - Warn if background_mode > 1 (unsupported modes)
  - Warn if adjustment_enabled = true
  - Warn if ssr_enabled = true
  - Info if fog emission non-zero
- [ ] Create `packages/textscene-core/src/resources/environment/linter.test.ts`
  - Test valid properties pass
  - Test invalid background_mode fails
  - Test invalid color format fails
  - Test warnings for unsupported features
  - **MINIMUM 6 tests**
- [ ] **Immediate**: `pnpm type-check`
- [ ] **Immediate**: `pnpm --filter @textscene/core test linter.test.ts`
- [ ] Fix any errors before proceeding

---

### Phase 2: WorldEnvironment Node (1.5 hours)

#### 2.1: Types & Parser (45 min)
- [ ] Create `packages/textscene-core/src/nodes/3d/worldenvironment/types.ts`
  - WorldEnvironmentProperties interface (extends Node3DProperties)
  - environment: string (SubResource reference)
  - camera_attributes?: string (optional)
- [ ] Create `packages/textscene-core/src/nodes/3d/worldenvironment/parser.ts`
  - isWorldEnvironment() type guard
  - parseWorldEnvironment() function
  - Extend from parseNode3D()
- [ ] Create `packages/textscene-core/src/nodes/3d/worldenvironment/parser.test.ts`
  - Test basic WorldEnvironment parsing
  - Test with camera_attributes
  - Test environment reference extraction
  - **MINIMUM 3 tests**
- [ ] **Immediate**: `pnpm --filter @textscene/core build`
- [ ] **Immediate**: `pnpm type-check`
- [ ] **Immediate**: `pnpm test parser.test.ts`

#### 2.2: Renderer (30 min)
- [ ] Create `packages/textscene-core/src/nodes/3d/worldenvironment/renderer.ts`
  - createWorldEnvironment() function
  - Create THREE.Group marker
  - Resolve Environment SubResource from scene.internalResources
  - Parse Environment and create settings
  - Store in group.userData.environmentSettings
- [ ] Create `packages/textscene-core/src/nodes/3d/worldenvironment/renderer.test.ts`
  - Test creates Group with correct name
  - Test resolves Environment SubResource
  - Test stores environmentSettings in userData
  - Test handles missing Environment gracefully
  - **MINIMUM 4 tests**
- [ ] **Immediate**: `pnpm type-check`
- [ ] **Immediate**: `pnpm test renderer.test.ts`

#### 2.3: Property Formatter & Registration (15 min)
- [ ] Create `packages/textscene-core/src/nodes/3d/worldenvironment/propertyFormatter.ts`
  - formatWorldEnvironmentProperties() function
  - Format environment reference for UI
  - Format camera_attributes if present
- [ ] Create `packages/textscene-core/src/nodes/3d/worldenvironment/index.renderer.ts`
  - Register with NodeRegistry
  - Export all public APIs
- [ ] **Immediate**: `pnpm --filter @textscene/core build`
- [ ] **Immediate**: `pnpm type-check`

**Note**: Linter already exists (linterParser.ts, linter.ts, linter.test.ts)

---

### Phase 3: TscnRenderer Integration (1 hour)

#### 3.1: Add applyWorldEnvironment() Method
- [ ] Edit `packages/textscene-core/src/core/TscnRenderer.ts`
  - Add private applyWorldEnvironment(sceneData: TscnScene) method
  - Find WorldEnvironment node via nodeTracker
  - Apply background color if BG_COLOR mode
  - Apply fog if enabled (THREE.FogExp2)
  - Log warnings for unsupported features
  - Call in performRender() after adding all nodes
- [ ] **Immediate**: `pnpm --filter @textscene/core build`
- [ ] **Immediate**: `pnpm type-check`

#### 3.2: Integration Test
- [ ] Create `packages/textscene-core/src/core/TscnRenderer.worldenvironment.test.ts`
  - Test background color applied to scene
  - Test fog applied to scene
  - Test warnings logged for adjustments
  - Test warnings logged for SSR
  - **MINIMUM 4 tests**
- [ ] **Immediate**: `pnpm test TscnRenderer.worldenvironment.test.ts`

---

### Phase 4: Parser Registration (15 min)

- [ ] Edit `packages/textscene-core/src/parser/TscnParser.ts`
  - Add import: `import '../nodes/3d/worldenvironment/index.renderer.js';`
- [ ] Edit `packages/textscene-core/src/linter/index.ts`
  - Add import: `import '../nodes/3d/worldenvironment/linterParser.js';`
  - Add import: `import '../nodes/3d/worldenvironment/linter.js';`
  - Add import: `import '../resources/environment/linterParser.js';`
  - Add import: `import '../resources/environment/linter.js';`
- [ ] **Immediate**: `pnpm --filter @textscene/core build`
- [ ] **Immediate**: `pnpm type-check`
- [ ] **Immediate**: `pnpm test` (run all tests)

---

### Phase 5: Fixtures (1 hour)

#### 5.1: Basic Fixture
- [ ] Create `scenes/fixtures/unit-world-environment-basic.tscn`
  - BG_COLOR mode with brown background Color(0.15, 0.12, 0.1, 1)
  - Volumetric fog enabled
  - Fog density: 0.001
  - Fog albedo: Color(0.8, 0.8, 0.9, 1) (blueish tint)
  - Test box at z=-10 to show fog effect
  - OmniLight3D for illumination
- [ ] Lint fixture: `node apps/textscene-linter/dist/cli.js scenes/fixtures/unit-world-environment-basic.tscn`
- [ ] **MUST PASS**: Zero linting errors

#### 5.2: No Fog Fixture
- [ ] Create `scenes/fixtures/unit-world-environment-no-fog.tscn`
  - BG_COLOR mode with blue background Color(0.2, 0.4, 0.8, 1)
  - Volumetric fog DISABLED
  - Multiple objects at various distances
  - Clear visibility
- [ ] Lint fixture: Zero errors required

#### 5.3: Unsupported Features Fixture
- [ ] Create `scenes/fixtures/edge-world-environment-unsupported.tscn`
  - background_mode = 2 (BG_SKY - should warn)
  - adjustment_enabled = true (should warn)
  - ssr_enabled = true (should warn)
  - volumetric_fog_emission non-zero (should info)
- [ ] Lint fixture: Should have warnings (not errors)

#### 5.4: Add to Web Previewer
- [ ] Edit `apps/textscene-web/src/fixtures.ts`
  - Add category: 'Unit - Environment' if not exists
  - Add: { name: 'World Environment - Basic', file: 'unit-world-environment-basic.tscn', category: 'Unit - Environment' }
  - Add: { name: 'World Environment - No Fog', file: 'unit-world-environment-no-fog.tscn', category: 'Unit - Environment' }
  - Add to 'Edge Cases': { name: 'World Environment - Unsupported', file: 'edge-world-environment-unsupported.tscn', category: 'Edge Cases' }
- [ ] **Immediate**: `pnpm --filter @textscene/web build`

---

### Phase 6: Final Validation (45 min)

#### 6.1: Type Check
- [ ] Run: `pnpm type-check`
- [ ] Fix any type errors immediately
- [ ] **MUST PASS**: Zero type errors

#### 6.2: All Tests
- [ ] Run: `pnpm test`
- [ ] Fix any test failures immediately
- [ ] **MUST PASS**: All tests green
- [ ] Verify minimum test counts:
  - Environment parser: 5+ tests
  - Environment renderer: 4+ tests
  - Environment linter: 6+ tests
  - WorldEnvironment parser: 3+ tests
  - WorldEnvironment renderer: 4+ tests
  - TscnRenderer integration: 4+ tests
  - **TOTAL: 26+ tests minimum**

#### 6.3: Lint All Fixtures
- [ ] Build linter: `pnpm --filter @textscene/linter build`
- [ ] Lint basic fixture: Zero errors
- [ ] Lint no-fog fixture: Zero errors
- [ ] Lint unsupported fixture: Warnings only (no errors)

#### 6.4: Manual Testing (Web Previewer)
- [ ] Start web previewer: `cd apps/textscene-web && pnpm dev`
- [ ] Load fixture: unit-world-environment-basic.tscn
  - [ ] Verify background color is dark brown (not default gray)
  - [ ] Verify fog is visible on distant box
  - [ ] Check console: Should log "Applied background color"
  - [ ] Check console: Should log "Applied volumetric fog"
- [ ] Load fixture: unit-world-environment-no-fog.tscn
  - [ ] Verify background color is blue
  - [ ] Verify NO fog (objects at distance are clear)
- [ ] Load fixture: edge-world-environment-unsupported.tscn
  - [ ] Check console: Should warn about BG_SKY unsupported
  - [ ] Check console: Should warn about adjustments
  - [ ] Check console: Should warn about SSR
  - [ ] Check console: Should info about fog emission
- [ ] Take screenshots for documentation

#### 6.5: Final Commit
- [ ] Update TODO.md: Mark WI-57 as complete `[x]`
- [ ] Update TODO.md: Change status from "In progress" to "Complete"
- [ ] Stage all changes: `git add .`
- [ ] Commit: `git commit -m "Implement WI-57: WorldEnvironment + Environment SubResource"`
- [ ] Push: `git push -u origin <branch>`

---

## 📊 Success Criteria Checklist

### Functionality
- [ ] Environment SubResource parser extracts all v1 properties
- [ ] WorldEnvironment node parser extracts environment reference
- [ ] Background color (BG_COLOR mode) applies to THREE.js scene
- [ ] Volumetric fog renders with correct color and density
- [ ] Warnings logged for unsupported features (adjustments, SSR, BG modes > 1)
- [ ] TscnRenderer.applyWorldEnvironment() integrates correctly

### Testing
- [ ] 26+ unit tests written and passing
- [ ] Integration test for TscnRenderer
- [ ] All fixtures pass linting (errors only for edge cases)
- [ ] Manual testing confirms visual correctness

### Code Quality
- [ ] Zero type errors (`pnpm type-check`)
- [ ] Zero test failures (`pnpm test`)
- [ ] All public methods have 3+ tests
- [ ] No placeholder code or TODOs
- [ ] Complete implementation (no stubs)

### Documentation
- [ ] 3 fixtures created covering different scenarios
- [ ] Fixtures added to web previewer
- [ ] Console logs provide clear feedback
- [ ] TODO.md updated

---

## 🚨 Critical Reminders

1. **Build after EVERY file**: `pnpm --filter @textscene/core build`
2. **Type-check immediately**: `pnpm type-check`
3. **Test immediately**: `pnpm --filter @textscene/core test <filename>`
4. **NO placeholders**: Complete implementation only
5. **Fix errors NOW**: Don't defer type/test errors
6. **3+ tests minimum**: Every public method
7. **Lint fixtures**: Before committing

---

## 📝 Progress Tracking

### Phase 1: Environment SubResource
- Status: Not Started
- Estimated: 2 hours
- Actual: TBD

### Phase 2: WorldEnvironment Node
- Status: Not Started
- Estimated: 1.5 hours
- Actual: TBD

### Phase 3: TscnRenderer Integration
- Status: Not Started
- Estimated: 1 hour
- Actual: TBD

### Phase 4: Parser Registration
- Status: Not Started
- Estimated: 15 minutes
- Actual: TBD

### Phase 5: Fixtures
- Status: Not Started
- Estimated: 1 hour
- Actual: TBD

### Phase 6: Final Validation
- Status: Not Started
- Estimated: 45 minutes
- Actual: TBD

**Total Estimated**: 6.5 hours
**Total Actual**: TBD
