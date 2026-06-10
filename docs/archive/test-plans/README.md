# E2E Test Plans

This folder contains end-to-end test plans for the TSCN File Previewer project. These test plans are designed to be executed by an LLM agent using the **e2e-testing skill** or **e2e-test-orchestrator agent** with Chrome DevTools MCP.

## Overview

Test plans are written in a structured markdown format that describes the expected behavior of the application. The LLM agent reads these plans and uses Chrome DevTools MCP tools to validate the application's functionality.

## Folder Structure

```
test-plans/
├── README.md                    # This file
├── web-previewer/              # Web previewer test plans
│   ├── 01-file-upload.md       # File upload functionality
│   ├── 02-rendering.md         # Canvas rendering validation
│   ├── 03-camera-controls.md   # Camera controls testing
│   ├── 04-error-handling.md    # Error handling scenarios
│   └── 05-ui-state.md          # UI state management
└── vscode-extension/           # VS Code extension test plans
    ├── 01-incremental-updates.md    # Hash-based incremental scene updates
    ├── 02-multi-panel-management.md # Multiple preview panels
    └── 03-hash-algorithm-validation.md # Node hashing algorithm tests
```

## How to Run E2E Tests

### Prerequisites

1. **Build the project:**
   ```bash
   pnpm build
   ```

2. **For web previewer tests:**
   ```bash
   cd apps/textscene-web
   pnpm preview
   ```
   The app will be available at `http://localhost:4173`

3. **For VS Code extension tests:**
   ```bash
   cd apps/textscene-vscode
   pnpm package
   ```
   Install the generated `.vsix` file in VS Code, then open a workspace with TSCN files.

### Execution

#### Option 1: Using the e2e-testing Skill

Invoke the `e2e-testing` skill in Claude Code:

```
Use the e2e-testing skill to run the test plans in test-plans/web-previewer/
```

```
Use the e2e-testing skill to run the test plans in test-plans/vscode-extension/
```

#### Option 2: Using the e2e-test-orchestrator Agent

Launch the agent to orchestrate comprehensive test execution:

```
Launch the e2e-test-orchestrator agent to run all web previewer test plans
```

The agent will:
1. Navigate to the web previewer
2. Execute each test scenario
3. Report results and any failures

## Test Plan Format

Each test plan file follows this structure:

```markdown
# Feature: [Feature Name]

Brief description of what this feature does.

## Test Environment

- **Application:** Web Previewer | VS Code Extension
- **URL:** http://localhost:4173 (for web previewer)
- **Prerequisites:** [Any setup needed]

## Scenarios

### Scenario 1: [Scenario Name]

**Given** [initial state]
**When** [action performed]
**Then** [expected result]
**And** [additional validation]

### Scenario 2: [Another Scenario]

[Similar structure...]
```

## Available Test Plans

### Web Previewer (5 test plans)

1. **01-file-upload.md** - Tests file upload functionality, including valid/invalid files
2. **02-rendering.md** - Validates canvas initialization and scene rendering
3. **03-camera-controls.md** - Tests camera reset and orbit controls
4. **04-error-handling.md** - Verifies error display for malformed files
5. **05-ui-state.md** - Tests scene info display and UI state transitions

### VS Code Extension (3 test plans)

1. **01-incremental-updates.md** - Tests hash-based incremental scene updates, camera preservation, and diff algorithm heuristics
2. **02-multi-panel-management.md** - Tests multiple preview panels, independent camera states, and panel lifecycle
3. **03-hash-algorithm-validation.md** - Unit and integration tests for the FNV-1a node hashing algorithm

## Chrome DevTools MCP Tools Used

The LLM agent uses these tools during test execution:

- `new_page` / `navigate_page` - Navigate to the application
- `upload_file` - Simulate file uploads
- `take_snapshot` - Capture DOM state for validation
- `evaluate_script` - Check JavaScript state (canvas, three.js objects)
- `list_console_messages` - Monitor for errors
- `click` - Interact with UI elements
- `take_screenshot` - Visual regression testing

## Test Fixtures

Test plans reference fixtures from `tests/fixtures/`:

- `simple_node3d.tscn` - Basic valid scene (4 nodes)
- `empty_scene.tscn` - Empty scene (edge case)
- `malformed_*.tscn` - Invalid files for error testing
- `large_hierarchy_*.tscn` - Stress tests (wide: 101 nodes, deep: 16 levels)
- `mesh_instance.tscn` - MeshInstance3D with geometry
- `camera.tscn` - Camera3D nodes
- `lights.tscn` - Light nodes

## Writing New Test Plans

When adding new test plans:

1. Use the existing format for consistency
2. Be specific about expected outcomes
3. Include both happy path and edge cases
4. Reference specific DOM elements/selectors
5. Specify exact error messages or UI states to validate
6. For VS Code extension tests, include file modification scenarios
7. For unit tests, include code snippets showing expected test structure

## Troubleshooting

### Preview Server Not Running

If tests fail to navigate:
```bash
cd apps/textscene-web
pnpm preview
```

### Build Out of Date

If tests don't reflect recent changes:
```bash
pnpm build
```

### Browser Issues

The e2e-testing skill uses Chrome DevTools MCP. Ensure Chrome is available and the MCP server is running.

### VS Code Extension Not Installed

For VS Code extension tests:
```bash
cd apps/textscene-vscode
pnpm package
code --install-extension tscn-previewer-*.vsix
```

## Test Categories

### Functional Tests (Web Previewer)
- File upload and parsing
- 3D rendering
- Camera controls
- Error handling
- UI state management

### Integration Tests (VS Code Extension)
- Incremental scene updates
- Multi-panel management
- File watching and auto-reload

### Unit Tests (Core Library)
- Node hashing algorithm (FNV-1a)
- Diff algorithm heuristics
- Resource resolution
- Transform parsing

## Future Test Plans

- Performance testing (FPS, memory usage)
- Accessibility testing (screen reader, keyboard navigation)
- Cross-browser testing (Chrome, Firefox, Edge)
- Visual regression testing (screenshot comparison)
- Stress testing (very large scenes, 1000+ nodes)
