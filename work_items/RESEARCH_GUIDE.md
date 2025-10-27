# Complete Research Guide for All Work Items

This guide provides the exact Context7 queries and implementation patterns needed for all 30 work items in the TSCN Renderer project.

## How to Use This Guide

For each work item:
1. **Context7 Queries**: Use these exact queries with the MCP Context7 tool to fetch documentation
2. **Key APIs**: The main APIs/classes you'll need to research and implement
3. **Implementation Pattern**: The architectural pattern to follow
4. **Key Considerations**: Critical implementation details

---

## Phase 2: Lighting

### ✅ WI-10: SpotLight3D Node [DOCUMENTED - See WI10.md]

**Context7 Queries:**
```typescript
// Godot
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "SpotLight3D light properties shadow",
  tokens: 3000
})

// three.js
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/mrdoob/three.js",
  topic: "SpotLight shadow",
  tokens: 3000
})
```

### ✅ WI-11: DirectionalLight3D Node [DOCUMENTED - See WI11.md]

**Context7 Queries:**
```typescript
// Godot
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "DirectionalLight3D properties shadow cascades",
  tokens: 3000
})

// three.js
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/mrdoob/three.js",
  topic: "DirectionalLight shadow orthographic camera",
  tokens: 3000
})
```

### ✅ WI-12: OmniLight3D Node [DOCUMENTED - See WI12.md]

**Context7 Queries:**
```typescript
// Godot
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "OmniLight3D shadow omni_range omni_attenuation",
  tokens: 2500
})

// three.js
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/mrdoob/three.js",
  topic: "PointLight constructor properties shadow",
  tokens: 2500
})
```

---

## Phase 3: Scene Composition

### WI-13: ExtResource Loading System

**Context7 Queries:**
```typescript
// Godot TSCN Format
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "TSCN ext_resource format PackedScene resource loading",
  tokens: 3000
})

// File I/O
WebFetch({
  url: "https://docs.godotengine.org/en/stable/contributing/development/file_formats/tscn.html",
  prompt: "Extract information about [ext_resource] format, uid mapping, and resource paths"
})
```

**Key APIs:**
- Godot: `[ext_resource]` format, resource UID system, resource paths (`res://`)
- Parser: Extract resource mappings, build resource registry
- Loader: Async resource loading, path resolution

**Implementation Pattern:**
```typescript
// 1. Parse [ext_resource] sections
interface ExtResource {
  type: string;
  uid: string;
  path: string;
  id: string; // Local ID for reference
}

// 2. Build resource registry
class ResourceRegistry {
  private resources: Map<string, ExtResource>;
  async loadResource(id: string): Promise<Resource>;
}

// 3. Use in node parser
// Parse: instance=ExtResource("id_1")
// Resolve: resourceRegistry.loadResource("id_1")
```

**Key Considerations:**
- Resource paths use `res://` protocol
- UIDs are globally unique identifiers
- Local IDs (`id_1`, `id_2`) map to UIDs
- Async loading required for external files
- Cache loaded resources to avoid duplicates

### WI-14: Scene Instancing

**Context7 Queries:**
```typescript
// Godot PackedScene
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "PackedScene instantiate scene composition hierarchy",
  tokens: 3000
})
```

**Key APIs:**
- Godot: `PackedScene`, scene instancing, `instance=ExtResource()`
- Parser: Detect instanced scenes, load external .tscn files
- Renderer: Maintain parent-child relationships across instances

**Implementation Pattern:**
```typescript
// 1. Detect instanced scenes
interface InstancedNode extends TscnNode {
  instance: string; // e.g., "ExtResource('id_1')"
}

// 2. Load and instantiate
async function instantiateScene(
  instanceRef: string,
  parentTransform: Transform3D
): Promise<THREE.Group> {
  const sceneData = await loadExternalScene(instanceRef);
  const sceneGraph = buildSceneGraph(sceneData);
  // Apply parent transform
  return sceneGraph;
}

// 3. Recursive building
function buildNode(node: TscnNode): THREE.Object3D {
  if (node.instance) {
    return await instantiateScene(node.instance, node.transform);
  }
  // Normal node building...
}
```

**Key Considerations:**
- Maintain transform hierarchy across instances
- Handle circular dependencies (scene A instances scene B which instances A)
- Cache instanced scenes to avoid reloading
- Preserve node paths across instances

---

## Phase 4: Advanced Features

### WI-15: Camera3D Node

**Context7 Queries:**
```typescript
// Godot Camera3D
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "Camera3D FOV projection perspective orthographic near far",
  tokens: 3000
})

// three.js Cameras
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/mrdoob/three.js",
  topic: "PerspectiveCamera OrthographicCamera properties",
  tokens: 3000
})
```

**Key APIs:**
- Godot: `Camera3D`, `projection` property (PERSPECTIVE/ORTHOGONAL), FOV, near/far planes
- three.js: `THREE.PerspectiveCamera`, `THREE.OrthographicCamera`

**Implementation Pattern:**
```typescript
interface Camera3DProperties {
  fov: number; // Field of view (degrees)
  projection: 'perspective' | 'orthogonal';
  near: number;
  far: number;
  size?: number; // For orthographic
}

function createCamera3D(props: Camera3DProperties, aspect: number) {
  if (props.projection === 'perspective') {
    return new THREE.PerspectiveCamera(props.fov, aspect, props.near, props.far);
  } else {
    // Orthographic
    const width = props.size || 1;
    const height = width / aspect;
    return new THREE.OrthographicCamera(-width/2, width/2, height/2, -height/2, props.near, props.far);
  }
}
```

**Key Considerations:**
- FOV conversion: Godot uses vertical FOV, three.js uses vertical FOV (same!)
- Aspect ratio must be calculated from viewport
- Orthographic size mapping
- Camera transform (position/rotation)
- Current camera vs scene cameras

### WI-16: ShaderMaterial SubResource

**Context7 Queries:**
```typescript
// Godot ShaderMaterial
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "ShaderMaterial shader_parameter shader reference",
  tokens: 3000
})
```

**Key APIs:**
- Godot: `ShaderMaterial`, `shader` reference, `shader_parameter/*` properties
- Parser: Link to Shader sub-resources, extract uniform parameters

**Implementation Pattern:**
```typescript
interface ShaderMaterialProperties {
  shader: string; // Reference to SubResource
  parameters: Map<string, any>; // shader_parameter/name -> value
}

// Parse shader_parameter/albedo_color = Color(1, 0, 0, 1)
// Maps to uniforms in three.js ShaderMaterial
```

**Key Considerations:**
- Shader parameters are prefixed with `shader_parameter/`
- Must link to Shader SubResource
- Type mapping for parameters (float, vec3, Color, etc.)

### WI-17: Custom Shader Support

**Context7 Queries:**
```typescript
// Godot Shading Language
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "Godot shading language GLSL shader spatial canvas",
  tokens: 3000
})

// three.js ShaderMaterial
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/mrdoob/three.js",
  topic: "ShaderMaterial uniforms vertexShader fragmentShader",
  tokens: 3000
})
```

**Key APIs:**
- Godot: Godot Shading Language (based on GLSL), `shader_type spatial/canvas_item`
- three.js: `THREE.ShaderMaterial`, `uniforms`, `vertexShader`, `fragmentShader`
- Conversion: Godot shader syntax → GLSL/three.js shader syntax

**Implementation Pattern:**
```typescript
interface Shader {
  code: string; // Raw Godot shader code
  type: 'spatial' | 'canvas_item';
}

function convertGodotShader(godotShader: string): {
  vertexShader: string;
  fragmentShader: string;
  uniforms: any;
} {
  // Parse Godot shader syntax
  // Convert built-ins (VERTEX, NORMAL, UV, ALBEDO, etc.)
  // Extract uniforms
  // Generate GLSL code
}
```

**Key Considerations:**
- Godot built-ins: VERTEX, NORMAL, UV, COLOR, ALBEDO, ROUGHNESS, METALLIC
- Coordinate system differences
- Lighting model differences
- Complex conversion - consider starting with basic support

---

## Phase 5: Additional Mesh Primitives

### WI-18: Additional Mesh Types

**Context7 Queries:**
```typescript
// Godot Meshes
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "PlaneMesh CapsuleMesh TorusMesh PrismMesh properties",
  tokens: 3000
})

// three.js Geometries
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/mrdoob/three.js",
  topic: "PlaneGeometry CapsuleGeometry TorusGeometry geometry",
  tokens: 3000
})
```

**Key APIs:**
- **PlaneMesh**: `size` (Vector2), `subdivide_width`, `subdivide_depth`
  - three.js: `PlaneGeometry(width, height, widthSegments, heightSegments)`
- **CapsuleMesh**: `radius`, `height`, `rings`, `radial_segments`
  - three.js: `CapsuleGeometry(radius, length, capSegments, radialSegments)`
- **TorusMesh**: `inner_radius`, `outer_radius`, `rings`, `ring_segments`
  - three.js: `TorusGeometry(outerRadius, tubeRadius, radialSegments, tubularSegments)`
- **PrismMesh**: `left_to_right`, `size`
  - three.js: Custom geometry or `CylinderGeometry` with modifications

**Implementation Pattern:**
Follow the same vertical slicing pattern as BoxMesh, CylinderMesh, SphereMesh:
```
packages/textscene-renderer/src/resources/meshes/
├── planemesh/
│   ├── parser.ts
│   ├── renderer.ts
│   └── index.ts
├── capsulemesh/
├── torusmesh/
└── prismmesh/
```

---

## Testing & Documentation

### WI-19: End-to-End Scene Testing

**Context7 Queries:**
```typescript
// Vitest
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/vitest_dev",
  topic: "e2e testing browser automation visual regression",
  tokens: 3000
})
```

**Key APIs:**
- Vitest: Test configuration, test suites, assertions
- Chrome DevTools MCP: Browser automation (`navigate_page`, `take_screenshot`, `evaluate_script`)
- Visual regression: Screenshot comparison

**Implementation Pattern:**
```typescript
// Test complete scene rendering
describe('Hallway Scene E2E', () => {
  it('renders all mesh instances', async () => {
    // Load scene
    const scene = await loadScene('hallway.tscn');
    const renderer = new TscnRenderer(canvas);
    await renderer.render(scene);

    // Verify mesh count
    const meshes = scene.traverse((obj) => obj.type === 'Mesh');
    expect(meshes.length).toBe(200);
  });

  it('matches visual baseline', async () => {
    // Render and screenshot
    const screenshot = await takeScreenshot();
    // Compare with baseline
    expect(screenshot).toMatchImageSnapshot();
  });
});
```

### WI-20: Documentation Updates

**Key Tasks:**
- Update README with supported node types
- Document all implemented features
- Add usage examples for each node type
- Create migration guide from Godot to renderer
- Document limitations and known issues

---

## Phase 7: C# Integration

### WI-25: GetNode() Path Validation

**Context7 Queries:**
```typescript
// VS Code Diagnostics
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/websites/code_visualstudio_api",
  topic: "Diagnostic DiagnosticCollection TextDocument validation",
  tokens: 3000
})
```

**Key APIs:**
- VS Code: `vscode.DiagnosticCollection`, `vscode.Diagnostic`, `vscode.DiagnosticSeverity`
- C# Parsing: Find GetNode() calls, extract path arguments
- Path Validation: Check path exists in scene hierarchy

**Implementation Pattern:**
```typescript
// 1. Parse C# file for GetNode() calls
function findGetNodeCalls(document: vscode.TextDocument): GetNodeCall[] {
  const regex = /GetNode(?:<[^>]+>)?\s*\(\s*["']([^"']+)["']\s*\)/g;
  // Extract paths
}

// 2. Validate against scene
function validateNodePath(path: string, sceneData: TscnScene): boolean {
  // Check if path exists in scene hierarchy
}

// 3. Create diagnostics
const diagnostics: vscode.Diagnostic[] = [];
for (const call of invalidCalls) {
  diagnostics.push(new vscode.Diagnostic(
    call.range,
    `Node path "${call.path}" not found in scene`,
    vscode.DiagnosticSeverity.Error
  ));
}
```

### WI-26: GetNode() IntelliSense and Autocomplete

**Context7 Queries:**
```typescript
// VS Code Completion
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/websites/code_visualstudio_api",
  topic: "CompletionItemProvider CompletionItem IntelliSense",
  tokens: 3000
})
```

**Key APIs:**
- VS Code: `vscode.CompletionItemProvider`, `vscode.CompletionItem`, `vscode.CompletionItemKind`
- Trigger: Inside GetNode() string argument

**Implementation Pattern:**
```typescript
class NodePathCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    // Check if inside GetNode() call
    // Load associated .tscn file
    // Build completion list from scene hierarchy

    const items: vscode.CompletionItem[] = [];
    for (const node of sceneNodes) {
      items.push(new vscode.CompletionItem(
        node.path,
        vscode.CompletionItemKind.Reference
      ));
    }
    return items;
  }
}
```

### WI-27: C# Class → Scene Type Matching

**Context7 Queries:**
```typescript
// C# Parsing
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "microsoft/typescript", // For parsing concepts
  topic: "AST parsing class inheritance base class",
  tokens: 2000
})
```

**Key APIs:**
- Parse C# file: Extract base class from script
- Parse .tscn file: Extract root node type
- Compare: Show warning if mismatched

**Implementation Pattern:**
```typescript
// 1. Extract C# base class
function extractBaseClass(csFile: string): string {
  // Parse: public class Player : CharacterBody2D
  // Return: "CharacterBody2D"
}

// 2. Get scene root type
function getSceneRootType(tscnFile: string): string {
  // Parse root node type
}

// 3. Validate
if (baseClass !== rootType && !isCompatible(baseClass, rootType)) {
  showWarning(`Scene root: ${rootType}, Script base: ${baseClass} - Type mismatch!`);
}
```

### WI-28: Scene-to-C# Code Generation

**Context7 Queries:**
```typescript
// Code Generation
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "microsoft/typescript",
  topic: "code generation AST templates",
  tokens: 2000
})
```

**Key APIs:**
- Command: `Generate Node Properties`
- Generate C# partial class with strongly-typed properties

**Implementation Pattern:**
```typescript
function generateNodeProperties(scene: TscnScene): string {
  let code = `// Auto-generated node properties\n`;
  code += `public partial class ${scene.rootNode.name}\n{\n`;

  for (const child of scene.rootNode.children) {
    const typeName = child.type;
    const propertyName = toPascalCase(child.name);

    code += `    public ${typeName} ${propertyName} { get; private set; }\n`;
  }

  code += `\n    private void InitializeNodes()\n    {\n`;
  for (const child of scene.rootNode.children) {
    code += `        ${toPascalCase(child.name)} = GetNode<${child.type}>("${child.name}");\n`;
  }
  code += `    }\n}\n`;

  return code;
}
```

---

## Phase 8: Interactive Editing

### WI-29: Real-time Property Editing

**Context7 Queries:**
```typescript
// VS Code Text Edits
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/websites/code_visualstudio_api",
  topic: "WorkspaceEdit TextEdit TextDocument edit apply",
  tokens: 3000
})
```

**Key APIs:**
- VS Code: `vscode.WorkspaceEdit`, `vscode.TextEdit`, `document.applyEdit()`
- Webview: Two-way messaging for property changes
- Parser: Update TSCN property values

**Implementation Pattern:**
```typescript
// 1. UI sends property change
webview.postMessage({
  type: 'propertyChanged',
  nodePath: '/root/Player',
  property: 'position',
  value: 'Vector3(10, 5, 0)'
});

// 2. Extension updates .tscn file
async function updateProperty(path: string, prop: string, value: string) {
  const edit = new vscode.WorkspaceEdit();
  const range = findPropertyRange(document, path, prop);
  edit.replace(document.uri, range, `${prop} = ${value}`);
  await vscode.workspace.applyEdit(edit);
}

// 3. Renderer updates 3D preview
renderer.updateNode(path, { [prop]: parseValue(value) });
```

### WI-30: Node Transformation Gizmos

**Context7 Queries:**
```typescript
// three.js TransformControls
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/mrdoob/three.js",
  topic: "TransformControls translate rotate scale gizmo",
  tokens: 3000
})
```

**Key APIs:**
- three.js: `THREE/addons/controls/TransformControls`, `TransformControls.setMode()`
- Raycasting: `THREE.Raycaster` for object selection

**Implementation Pattern:**
```typescript
import { TransformControls } from 'three/addons/controls/TransformControls.js';

// 1. Create transform controls
const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.addEventListener('dragging-changed', (event) => {
  orbitControls.enabled = !event.value;
});
scene.add(transformControls);

// 2. On node selection
function selectNode(nodePath: string) {
  const object = scene.getObjectByName(nodePath);
  transformControls.attach(object);
}

// 3. On transform change
transformControls.addEventListener('objectChange', () => {
  const object = transformControls.object;
  if (object) {
    // Update TSCN file with new transform
    updateTransform(object.name, object.position, object.quaternion, object.scale);
  }
});

// 4. Toggle modes
function setTransformMode(mode: 'translate' | 'rotate' | 'scale') {
  transformControls.setMode(mode);
}
```

### WI-31: Undo/Redo Support

**Context7 Queries:**
```typescript
// Command Pattern
// (No specific Context7 query needed - design pattern)
```

**Key APIs:**
- Command Pattern: `execute()`, `undo()`, `redo()`
- VS Code: Integrate with native undo/redo (Ctrl+Z, Ctrl+Y)

**Implementation Pattern:**
```typescript
// 1. Command interface
interface Command {
  execute(): void;
  undo(): void;
}

// 2. Example: Transform command
class TransformCommand implements Command {
  constructor(
    private object: THREE.Object3D,
    private oldTransform: Transform,
    private newTransform: Transform
  ) {}

  execute() {
    this.object.position.copy(this.newTransform.position);
    this.object.quaternion.copy(this.newTransform.rotation);
    this.object.scale.copy(this.newTransform.scale);
  }

  undo() {
    this.object.position.copy(this.oldTransform.position);
    this.object.quaternion.copy(this.oldTransform.rotation);
    this.object.scale.copy(this.oldTransform.scale);
  }
}

// 3. Command history
class CommandHistory {
  private history: Command[] = [];
  private current: number = -1;

  execute(command: Command) {
    // Remove any commands after current position
    this.history = this.history.slice(0, this.current + 1);
    command.execute();
    this.history.push(command);
    this.current++;
  }

  undo() {
    if (this.current >= 0) {
      this.history[this.current].undo();
      this.current--;
    }
  }

  redo() {
    if (this.current < this.history.length - 1) {
      this.current++;
      this.history[this.current].execute();
    }
  }
}
```

---

## Phase 9: Enhanced Visualization

### WI-32: Resource Thumbnail Previews

**Context7 Queries:**
```typescript
// VS Code Webview Resources
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/websites/code_visualstudio_api",
  topic: "Webview asWebviewUri localResourceRoots image",
  tokens: 3000
})
```

**Key APIs:**
- VS Code: `webview.asWebviewUri()` for loading local images
- Image Loading: Load textures from project `res://` paths
- Thumbnail Generation: Resize images, create previews

**Implementation Pattern:**
```typescript
// 1. Load texture from project
async function loadTexture(path: string): Promise<ImageData> {
  // Convert res:// path to file system path
  const fsPath = resolveResourcePath(path);
  // Load image
  return await loadImage(fsPath);
}

// 2. Generate thumbnail
function generateThumbnail(image: ImageData, size: number): string {
  // Resize to thumbnail size
  // Return data URL
  return canvas.toDataURL();
}

// 3. Display in tree
function addThumbnailToTree(node: Element, thumbnailUrl: string) {
  const img = document.createElement('img');
  img.src = thumbnailUrl;
  img.style.width = '16px';
  img.style.height = '16px';
  node.appendChild(img);
}
```

### WI-33: Texture/Material Inspector Panel

**Context7 Queries:**
```typescript
// Godot Resource Formats
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "Texture2D Image format properties dimensions",
  tokens: 2000
})
```

**Key APIs:**
- Godot: Texture2D, Material properties, resource metadata
- UI: Dedicated panel for asset inspection

**Implementation Pattern:**
```typescript
// 1. Texture inspector
interface TextureInfo {
  path: string;
  dimensions: { width: number; height: number };
  format: string;
  fileSize: number;
  preview: string; // Data URL
}

// 2. Material inspector
interface MaterialInfo {
  type: string; // StandardMaterial3D, ShaderMaterial, etc.
  properties: Record<string, any>;
  preview: string; // Rendered material preview
}

// 3. Inspector panel
function showInspector(resource: Resource) {
  if (resource.type === 'Texture') {
    showTextureInspector(resource);
  } else if (resource.type === 'Material') {
    showMaterialInspector(resource);
  }
}
```

### WI-34: Scene Complexity Metrics

**Key APIs:**
- Scene Analysis: Count nodes, measure depth, analyze resources
- Performance: Estimate draw calls, memory usage

**Implementation Pattern:**
```typescript
interface SceneMetrics {
  nodeCount: number;
  maxDepth: number;
  meshCount: number;
  materialCount: number;
  textureCount: number;
  lightCount: number;
  estimatedDrawCalls: number;
  estimatedMemory: number; // bytes
}

function analyzeScene(scene: TscnScene): SceneMetrics {
  const metrics: SceneMetrics = {
    nodeCount: 0,
    maxDepth: 0,
    meshCount: 0,
    materialCount: 0,
    textureCount: 0,
    lightCount: 0,
    estimatedDrawCalls: 0,
    estimatedMemory: 0,
  };

  function traverse(node: TscnNode, depth: number) {
    metrics.nodeCount++;
    metrics.maxDepth = Math.max(metrics.maxDepth, depth);

    if (node.type.includes('Mesh')) metrics.meshCount++;
    if (node.type.includes('Light')) metrics.lightCount++;

    for (const child of node.children) {
      traverse(child, depth + 1);
    }
  }

  traverse(scene.rootNode, 0);

  // Calculate draw calls (rough estimate)
  metrics.estimatedDrawCalls = metrics.meshCount;

  return metrics;
}
```

---

## Phase 10: Advanced Navigation

### WI-35: Signal Connection Visualization

**Context7 Queries:**
```typescript
// Godot Signals
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "signals connection format signal_name method callable",
  tokens: 3000
})
```

**Key APIs:**
- Godot: `[connection]` sections in TSCN format
- Format: `signal="signal_name" from="NodePath" to="NodePath" method="method_name"`

**Implementation Pattern:**
```typescript
interface SignalConnection {
  signal: string;
  from: string; // Node path
  to: string;   // Node path
  method: string;
  flags?: number;
}

// Parse [connection] sections
function parseConnections(tscnContent: string): SignalConnection[] {
  // Find [connection] sections
  // Extract signal, from, to, method
}

// Visualize in tree
function showSignalBadge(node: TreeNode, connections: SignalConnection[]) {
  const count = connections.filter(c => c.from === node.path).length;
  if (count > 0) {
    node.addBadge(`📡 ${count}`);
  }
}
```

### WI-36: Enhanced Scene Instance Tracking

**Context7 Queries:**
```typescript
// Already covered in WI-14
```

**Key APIs:**
- Parse `instance=ExtResource()`
- Show inheritance chain
- Navigate to scene definition

**Implementation Pattern:**
```typescript
// 1. Detect instances
function isInstancedNode(node: TscnNode): boolean {
  return node.hasOwnProperty('instance');
}

// 2. Context menu action
function showInstanceActions(node: TscnNode) {
  if (isInstancedNode(node)) {
    return [
      {
        label: 'Go to Scene Definition',
        action: () => openScene(node.instance)
      },
      {
        label: 'Show Instance Chain',
        action: () => showInheritanceChain(node)
      }
    ];
  }
}
```

### WI-37: Node Path Copy/Generation

**Context7 Queries:**
```typescript
// VS Code Commands & Clipboard
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/websites/code_visualstudio_api",
  topic: "commands clipboard writeText TextEditor insertSnippet",
  tokens: 2000
})
```

**Key APIs:**
- VS Code: `vscode.env.clipboard.writeText()`, `commands.registerCommand()`
- Code Generation: Generate GetNode() snippets

**Implementation Pattern:**
```typescript
// 1. Copy node path
vscode.commands.registerCommand('tscn.copyNodePath', (node) => {
  const path = getNodePath(node);
  vscode.env.clipboard.writeText(path);
});

// 2. Generate GetNode() snippet
vscode.commands.registerCommand('tscn.generateGetNode', (node) => {
  const path = getNodePath(node);
  const type = node.type;

  // C# version
  const csharpCode = `GetNode<${type}>("${path}")`;

  // GDScript version
  const gdscriptCode = `get_node("${path}")`;

  vscode.env.clipboard.writeText(csharpCode);
});

// 3. Drag and drop
treeView.onDidDragNode((node) => {
  // Generate code snippet for dragged node
});
```

### WI-38: Cross-Reference Analysis

**Context7 Queries:**
```typescript
// VS Code Search & References
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/websites/code_visualstudio_api",
  topic: "workspace findFiles findTextInFiles ReferenceProvider",
  tokens: 3000
})
```

**Key APIs:**
- VS Code: `workspace.findFiles()`, `workspace.findTextInFiles()`
- Reference Provider: Show all references to a scene

**Implementation Pattern:**
```typescript
// 1. Find all scene references
async function findSceneReferences(scenePath: string): Promise<Reference[]> {
  const pattern = `**/*.tscn`;
  const files = await vscode.workspace.findFiles(pattern);

  const references: Reference[] = [];
  for (const file of files) {
    const content = await readFile(file);
    if (content.includes(scenePath)) {
      references.push({ file, type: 'scene' });
    }
  }

  // Also search C# files for PackedScene references
  const csFiles = await vscode.workspace.findFiles('**/*.cs');
  for (const file of csFiles) {
    const content = await readFile(file);
    if (content.includes(scenePath)) {
      references.push({ file, type: 'code' });
    }
  }

  return references;
}

// 2. Show dependency graph
function showDependencyGraph(scene: string) {
  // Build graph of all scene dependencies
  // Visualize as tree or network diagram
}
```

---

## Phase 11: Animation & Performance

### WI-39: Animation Preview Support

**Context7 Queries:**
```typescript
// Godot AnimationPlayer
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "websites/godotengine_en_stable",
  topic: "AnimationPlayer Animation track keyframe interpolation",
  tokens: 3000
})

// three.js Animation
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/mrdoob/three.js",
  topic: "AnimationMixer AnimationClip KeyframeTrack AnimationAction",
  tokens: 3000
})
```

**Key APIs:**
- Godot: `AnimationPlayer`, `Animation`, animation tracks, keyframes
- three.js: `THREE.AnimationMixer`, `THREE.AnimationClip`, `THREE.KeyframeTrack`

**Implementation Pattern:**
```typescript
interface AnimationTrack {
  path: string; // Node path
  property: string; // e.g., "position", "rotation"
  keyframes: Keyframe[];
  interpolation: 'linear' | 'cubic' | 'step';
}

interface Keyframe {
  time: number;
  value: any;
}

// Convert Godot animation to three.js
function convertAnimation(godotAnim: GodotAnimation): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  for (const track of godotAnim.tracks) {
    const times = track.keyframes.map(kf => kf.time);
    const values = track.keyframes.map(kf => kf.value);

    tracks.push(new THREE.VectorKeyframeTrack(
      `${track.path}.${track.property}`,
      times,
      values.flat()
    ));
  }

  return new THREE.AnimationClip('animation', -1, tracks);
}

// Playback controls
class AnimationController {
  private mixer: THREE.AnimationMixer;
  private action: THREE.AnimationAction;

  play() { this.action.play(); }
  pause() { this.action.paused = !this.action.paused; }
  stop() { this.action.stop(); }
  setTime(time: number) { this.action.time = time; }
}
```

### WI-40: Performance Optimization for Large Scenes

**Context7 Queries:**
```typescript
// Virtual Scrolling
// (No specific Context7 - common web pattern)

// three.js Optimization
mcp__context7__get-library-docs({
  context7CompatibleLibraryID: "/mrdoob/three.js",
  topic: "frustum culling LOD level of detail instancing",
  tokens: 3000
})
```

**Key APIs:**
- Virtual Scrolling: Only render visible tree nodes
- LOD (Level of Detail): Reduce geometry complexity for distant objects
- Frustum Culling: Don't render objects outside view
- Instancing: Batch identical objects

**Implementation Pattern:**
```typescript
// 1. Virtual tree viewer
class VirtualTreeViewer {
  private visibleRange: { start: number; end: number };

  render() {
    // Only render nodes within visible range
    const nodes = this.allNodes.slice(this.visibleRange.start, this.visibleRange.end);
    this.renderNodes(nodes);
  }

  onScroll(scrollTop: number) {
    // Calculate visible range
    this.visibleRange = this.calculateVisible Range(scrollTop);
    this.render();
  }
}

// 2. LOD for meshes
function setupLOD(object: THREE.Object3D) {
  const lod = new THREE.LOD();

  // High detail (close)
  lod.addLevel(highDetailMesh, 0);
  // Medium detail
  lod.addLevel(mediumDetailMesh, 50);
  // Low detail (far)
  lod.addLevel(lowDetailMesh, 100);

  return lod;
}

// 3. Frustum culling (automatic in three.js)
// But can optimize by pre-culling large sections
function cullSceneSection(camera: THREE.Camera, section: SceneSection): boolean {
  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
  );
  return frustum.intersectsBox(section.boundingBox);
}
```

### WI-41: Live Godot Editor Synchronization

**Context7 Queries:**
```typescript
// Godot Remote Protocol
WebFetch({
  url: "https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html",
  prompt: "Extract information about Godot's remote debugging protocol and editor communication"
})
```

**Key APIs:**
- Godot: Remote debug protocol (TCP/IP), `--remote-debug` flag
- WebSocket: Bidirectional communication
- Experimental feature

**Implementation Pattern:**
```typescript
// 1. Connect to Godot editor
class GodotEditorConnection {
  private socket: WebSocket;

  async connect(port: number = 6007) {
    this.socket = new WebSocket(`ws://localhost:${port}`);

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }

  sendPropertyChange(nodePath: string, property: string, value: any) {
    this.socket.send(JSON.stringify({
      type: 'property_change',
      path: nodePath,
      property: property,
      value: value
    }));
  }

  private handleMessage(message: any) {
    if (message.type === 'scene_changed') {
      // Reload scene in VS Code preview
      this.reloadScene();
    }
  }
}

// 2. Two-way sync
// VS Code changes → Godot
transformControls.addEventListener('objectChange', () => {
  godotConnection.sendPropertyChange(object.name, 'transform', object.matrix);
});

// Godot changes → VS Code
godotConnection.on('property_changed', (data) => {
  renderer.updateNode(data.path, { [data.property]: data.value });
});
```

**Key Considerations:**
- Experimental: Requires Godot running with remote debug enabled
- Security: Only connect to localhost
- Protocol: May need reverse-engineering or Godot plugin
- Fallback: Manual reload if connection fails

---

## Summary

This research guide provides:
- **Exact Context7 queries** for fetching documentation
- **Key APIs** needed for each work item
- **Implementation patterns** with code examples
- **Key considerations** for successful implementation

## Next Steps

For each work item:
1. Run the provided Context7 queries to fetch up-to-date documentation
2. Study the key APIs and implementation patterns
3. Create a detailed WI markdown file using the template in README.md
4. Implement following the vertical slicing pattern
5. Test according to the testing strategy

## Contributing

When researching a work item:
- Use these exact Context7 queries as a starting point
- Fetch additional documentation as needed
- Document any new findings
- Update this guide with improved queries or patterns
