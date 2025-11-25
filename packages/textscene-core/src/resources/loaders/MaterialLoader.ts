/**
 * Event-based material loader with deduplication and caching.
 * Emits events for material loading states and supports both
 * event-based and promise-based (backward-compatible) APIs.
 */

import * as THREE from 'three';
import type { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import type { TscnExternalResource } from '../../parser/types';
import type { ResourceRegistry } from '../ResourceRegistry';
import * as logger from '../../logger';

export interface MaterialMetadata {
  id: string;
  path: string;
  type: string;
}

export class MaterialLoader {
  private cache = new Map<string, THREE.Material | null>();
  private inflight = new Set<string>();
  private metadataMap = new Map<string, MaterialMetadata>();

  constructor(
    private eventBus: ResourceEventBus,
    private provider: ResourceProvider | null,
    private registry: ResourceRegistry
  ) {}

  /**
   * Register material metadata for lookup.
   */
  registerMetadata(id: string, resource: TscnExternalResource): void {
    this.metadataMap.set(id, {
      id,
      path: resource.path,
      type: resource.type,
    });
  }

  /**
   * Get registered metadata for a material.
   */
  getMetadata(id: string): MaterialMetadata | undefined {
    return this.metadataMap.get(id);
  }

  /**
   * Check if material is cached.
   */
  isCached(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * Check if material is currently loading.
   */
  isLoading(id: string): boolean {
    return this.inflight.has(id);
  }

  /**
   * Get cached material (may be null if load failed).
   */
  getCached(id: string): THREE.Material | null | undefined {
    return this.cache.get(id);
  }

  /**
   * Request a material to be loaded (non-blocking).
   * Emits events as loading progresses:
   * - material:requested - When load initiated
   * - material:loading - When actively loading
   * - material:loaded - When successfully loaded (includes material in data)
   * - material:failed - When load failed (includes error in data)
   *
   * If material is cached, immediately emits material:loaded.
   * If material is already loading, does nothing (deduplication).
   */
  request(id: string): void {
    // Check cache first
    if (this.cache.has(id)) {
      const cached = this.cache.get(id);
      if (cached !== null) {
        logger.info(`[MaterialLoader] Cache hit for: ${id}`);
        this.eventBus.emit<THREE.Material>('material', 'loaded', id, cached);
      } else {
        // Previously failed - emit failed again
        logger.info(`[MaterialLoader] Cache hit (failed) for: ${id}`);
        this.eventBus.emit<Error>(
          'material',
          'failed',
          id,
          new Error(`Material ${id} previously failed to load`)
        );
      }
      return;
    }

    // Deduplicate in-flight requests
    if (this.inflight.has(id)) {
      logger.info(`[MaterialLoader] Already loading: ${id}`);
      return;
    }

    // Start loading
    this.eventBus.emit('material', 'requested', id);
    this.loadAsync(id);
  }

  /**
   * Load material and return via promise (backward-compatible API).
   * Uses event bus internally.
   */
  async load(id: string): Promise<THREE.Material | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Start loading if not already
    this.request(id);

    // Wait for loaded or failed event
    try {
      return await this.eventBus.once<THREE.Material>('material', 'loaded', id);
    } catch {
      return null;
    }
  }

  private async loadAsync(id: string): Promise<void> {
    this.inflight.add(id);
    this.eventBus.emit('material', 'loading', id);
    const startTime = performance.now();

    try {
      const material = await this.loadMaterialFromProvider(id);
      this.cache.set(id, material);
      this.inflight.delete(id);

      const elapsed = performance.now() - startTime;
      logger.info(`[MaterialLoader] Loaded: ${id} (${elapsed.toFixed(2)}ms)`);
      this.eventBus.emit<THREE.Material>('material', 'loaded', id, material);
    } catch (error) {
      this.cache.set(id, null); // Cache failure to prevent retries
      this.inflight.delete(id);

      const elapsed = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[MaterialLoader] Failed: ${id} (${elapsed.toFixed(2)}ms)`, err);
      this.eventBus.emit<Error>('material', 'failed', id, err);
    }
  }

  private async loadMaterialFromProvider(id: string): Promise<THREE.Material> {
    const metadata = this.metadataMap.get(id);
    if (!metadata) {
      throw new Error(`Material metadata not found: ${id}`);
    }

    if (!metadata.type.includes('Material')) {
      throw new Error(`Not a material resource: ${id} (type: ${metadata.type})`);
    }

    if (!this.provider) {
      throw new Error('No ResourceProvider set');
    }

    // Load raw content via provider (returns string for .tres files)
    const content = await this.provider.loadResource(metadata.path, metadata.type);
    if (typeof content !== 'string') {
      throw new Error(`Material must be text content: ${metadata.path}`);
    }

    // Parse .tres file
    const { parseResourceFile } = await import('../../parser/resourceParsers');
    const { type, properties } = parseResourceFile(content);

    // Parse and create material based on type
    let material: THREE.Material;

    switch (type) {
      case 'StandardMaterial3D': {
        const { parseStandardMaterial3D } = await import('../materials/standardmaterial3d/parser');
        const { createStandardMaterial } = await import('../materials/standardmaterial3d/renderer');

        // Convert parsed properties to string format for compatibility with existing parser
        const stringProps: Record<string, string> = {};
        for (const [key, value] of Object.entries(properties)) {
          if (value && typeof value === 'object' && 'type' in value) {
            // Handle ParsedColor and ParsedVector3
            const typedValue = value as { type: string; r?: number; g?: number; b?: number; a?: number; x?: number; y?: number; z?: number };
            if (
              typedValue.type === 'Color' &&
              'r' in typedValue &&
              'g' in typedValue &&
              'b' in typedValue &&
              'a' in typedValue
            ) {
              stringProps[key] = `Color(${typedValue.r}, ${typedValue.g}, ${typedValue.b}, ${typedValue.a})`;
            } else if (
              typedValue.type === 'Vector3' &&
              'x' in typedValue &&
              'y' in typedValue &&
              'z' in typedValue
            ) {
              stringProps[key] = `Vector3(${typedValue.x}, ${typedValue.y}, ${typedValue.z})`;
            } else {
              stringProps[key] = String(value);
            }
          } else {
            stringProps[key] = String(value);
          }
        }

        // Pass the registry for texture loading (uses parallel loading via TextureLoader)
        const matProps = await parseStandardMaterial3D(stringProps, this.registry);
        material = createStandardMaterial(matProps);
        break;
      }

      case 'ShaderMaterial':
        throw new Error('ShaderMaterial not yet supported');

      default:
        throw new Error(`Unsupported material type: ${type}`);
    }

    return material;
  }

  /**
   * Clear cache for specific material (for hot-reload).
   */
  clearCache(id: string): void {
    this.cache.delete(id);
    this.inflight.delete(id);
    logger.info(`[MaterialLoader] Cleared cache for: ${id}`);
  }

  /**
   * Clear all cached materials.
   */
  clearAllCache(): void {
    this.cache.clear();
    this.inflight.clear();
    logger.info('[MaterialLoader] Cleared all cache');
  }

  /**
   * Set the resource provider.
   */
  setProvider(provider: ResourceProvider): void {
    this.provider = provider;
  }

  /**
   * Get cache size for debugging.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get number of in-flight requests.
   */
  getInflightCount(): number {
    return this.inflight.size;
  }
}
