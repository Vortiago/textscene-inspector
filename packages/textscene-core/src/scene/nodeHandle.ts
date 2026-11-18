import type { SceneValue } from './variant.js';
import type { CallResult } from './nodeMethods.js';

/** A node of the open scene, as a script holds it: by identity, for the life of the text. */
export interface NodeHandle {
  /** The absolute node path, as `get_path` gives it: `/root/Main/Player`. */
  readonly path: string;
  readonly name: string;
  /** The Godot class, as `get_class` gives it. */
  readonly type: string;
  /** `get_node`: throws `Node not found` where `path` names no node. */
  getNode(path: string): NodeHandle;
  getNodeOrNull(path: string): NodeHandle | null;
  /** Null for the root window. */
  getParent(): NodeHandle | null;
  getChildren(): readonly NodeHandle[];
  /** False once a new text freed the node, or a load took it out of the tree. */
  isInsideTree(): boolean;
  /** The last write, else the file's value, else the class default. Null for a name the class lacks. */
  get(property: string): Promise<SceneValue | null>;
  /** `Object::set`: true where Godot reports the write valid. */
  set(property: string, value: SceneValue): Promise<boolean>;
  /** `Object::call` of a ported method, or of a property's setter or getter. Throws for another. */
  call(method: string, ...args: SceneValue[]): Promise<CallResult>;
}

/** What a handle reads of its scene, every node named by its absolute path. */
export interface HandleHost {
  find(from: string, path: string): NodeHandle | null;
  typeOf(path: string): string | null;
  childPaths(path: string): readonly string[];
  handleAt(path: string): NodeHandle;
  get(path: string, property: string): Promise<SceneValue | null>;
  set(path: string, property: string, value: SceneValue): Promise<boolean>;
  call(path: string, method: string, args: readonly SceneValue[]): Promise<CallResult>;
}

/** The scene's own message for a miss, as `Node::get_node` prints it (`node.cpp:1954-1960`). */
export function nodeNotFound(from: string, path: string): Error {
  return new Error(`Node not found: "${path}" (relative to "${from}").`);
}

function parentPath(path: string): string | null {
  const slash = path.lastIndexOf('/');
  return slash > 0 ? path.slice(0, slash) : null;
}

export class SceneNodeHandle implements NodeHandle {
  readonly name: string;

  constructor(
    private readonly host: HandleHost,
    readonly path: string,
    readonly type: string
  ) {
    this.name = path.slice(path.lastIndexOf('/') + 1);
  }

  getNode(path: string): NodeHandle {
    const found = this.getNodeOrNull(path);
    if (!found) throw nodeNotFound(this.path, path);
    return found;
  }

  getNodeOrNull(path: string): NodeHandle | null {
    this.assertInsideTree();
    return this.host.find(this.path, path);
  }

  getParent(): NodeHandle | null {
    this.assertInsideTree();
    const parent = parentPath(this.path);
    return parent ? this.host.handleAt(parent) : null;
  }

  getChildren(): readonly NodeHandle[] {
    this.assertInsideTree();
    return this.host.childPaths(this.path).map((path) => this.host.handleAt(path));
  }

  isInsideTree(): boolean {
    return this.host.typeOf(this.path) === this.type && this.host.handleAt(this.path) === this;
  }

  async get(property: string): Promise<SceneValue | null> {
    this.assertInsideTree();
    return this.host.get(this.path, property);
  }

  async set(property: string, value: SceneValue): Promise<boolean> {
    this.assertInsideTree();
    return this.host.set(this.path, property, value);
  }

  async call(method: string, ...args: SceneValue[]): Promise<CallResult> {
    this.assertInsideTree();
    return this.host.call(this.path, method, args);
  }

  private assertInsideTree(): void {
    if (!this.isInsideTree()) {
      throw new Error(
        `expected a node inside the tree at ${this.path}, found it freed by a new text or a load`
      );
    }
  }
}
