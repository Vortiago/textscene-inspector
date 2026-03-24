/**
 * Shared test utilities to eliminate duplication across test files.
 */

import { vi } from 'vitest';
import type { TscnScene, TscnNode, TscnExternalResource } from '../parser/types';
import * as THREE from 'three';
import { ResourceEventBus } from '../resources/ResourceEventBus';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import type { ResourceProvider } from '../resources/ResourceProvider';

/**
 * Creates a mock WebGL renderer for testing without requiring WebGL context.
 * Use this in all tests that need a THREE.WebGLRenderer.
 */
export function createMockRenderer(): THREE.WebGLRenderer {
  const canvas = document.createElement('canvas');

  const mockRenderer = {
    render: vi.fn(),
    setSize: vi.fn(),
    dispose: vi.fn(),
    domElement: canvas,
    shadowMap: {
      enabled: false,
      type: THREE.PCFSoftShadowMap,
    },
  } as unknown as THREE.WebGLRenderer;

  return mockRenderer;
}

/**
 * Creates a mock logger with spies for testing.
 * Automatically cleaned up in afterEach hooks.
 */
export function createMockLogger(): {
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
} {
  return {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
}

/**
 * Quick helper to create a valid TscnScene for testing.
 * @param nodes - Root nodes to include (optional)
 * @param resources - Resources to include (optional)
 */
export function createTscnScene(
  nodes: TscnNode[] = [],
  resources: { externalResources?: any[]; internalResources?: any[] } = {}
): TscnScene {
  return {
    nodes,
    externalResources: resources.externalResources || [],
    internalResources: resources.internalResources || [],
  };
}

/**
 * Quick helper to create a TscnNode with sensible defaults.
 * @param overrides - Properties to override
 */
export function createTscnNode(overrides: Partial<TscnNode> = {}): TscnNode {
  return {
    name: 'TestNode',
    type: 'Node3D',
    properties: {},
    children: [],
    ...overrides,
  };
}

/**
 * Helper to create a node with children (for tree testing).
 */
export function createNodeWithChildren(
  name: string,
  childCount: number = 2
): TscnNode {
  const children: TscnNode[] = [];

  for (let i = 0; i < childCount; i++) {
    children.push(createTscnNode({
      name: `${name}_Child${i + 1}`,
      parent: name,
    }));
  }

  return createTscnNode({
    name,
    children,
  });
}

/**
 * Asserts that a value is defined and returns it with non-null type.
 * Better than toBeDefined() because it narrows the type.
 */
export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || `Expected value to be defined, but got ${value}`);
  }
}

/**
 * Helper for expecting exact values instead of .toBeDefined()
 */
export function expectExactValue<T>(actual: T | undefined, expected: T, message?: string): void {
  if (actual === undefined) {
    throw new Error(message || `Expected value ${JSON.stringify(expected)}, but got undefined`);
  }
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }
}

/**
 * Create a mock ResourceProvider with per-path switchable responses.
 * Change responses at any time to simulate resources becoming available.
 */
export function createMockResourceProvider(
  initialResponses: Map<string, () => Promise<string | ArrayBuffer>> = new Map()
): { provider: ResourceProvider; responses: Map<string, () => Promise<string | ArrayBuffer>> } {
  const responses = new Map(initialResponses);
  const provider: ResourceProvider = {
    loadResource: vi.fn(async (path: string, _type: string) => {
      const handler = responses.get(path);
      if (!handler) throw new Error(`Resource not found: ${path}`);
      return handler();
    }),
  };
  return { provider, responses };
}

/**
 * Create a pre-wired resource test bed with event bus, registry, and mock provider.
 */
export function createResourceTestBed(): {
  eventBus: ResourceEventBus;
  registry: ResourceRegistry;
  provider: ResourceProvider;
  responses: Map<string, () => Promise<string | ArrayBuffer>>;
} {
  const { provider, responses } = createMockResourceProvider();
  const registry = new ResourceRegistry();
  registry.setProvider(provider);
  const eventBus = registry.getEventBus();
  return { eventBus, registry, provider, responses };
}

/**
 * Create a TscnScene with a real ResourceRegistry for integration testing.
 */
export function createMockTscnSceneWithRegistry(
  options: {
    internalResources?: any[];
    externalResources?: TscnExternalResource[];
    nodes?: TscnNode[];
  } = {}
): { scene: TscnScene; registry: ResourceRegistry; eventBus: ResourceEventBus } {
  const registry = new ResourceRegistry();
  const eventBus = registry.getEventBus();

  for (const ext of options.externalResources || []) {
    registry.register(ext);
  }

  const scene: TscnScene = {
    nodes: options.nodes || [],
    externalResources: options.externalResources || [],
    internalResources: options.internalResources || [],
    resourceRegistry: registry,
  };

  return { scene, registry, eventBus };
}
