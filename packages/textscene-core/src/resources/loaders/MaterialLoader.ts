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

/**
 * Extended metadata for failed materials, including texture dependencies.
 * Used for targeted retry when specific textures become available.
 */
export interface FailedMaterialInfo {
  metadata: MaterialMetadata;
  /** Texture IDs this material is waiting for (extracted from content) */
  awaitingTextures: Set<string>;
}

export class MaterialLoader {
  private cache = new Map<string, THREE.Material | null>();
  private inflight = new Set<string>();
  private metadataMap = new Map<string, MaterialMetadata>();
  private failedMaterials = new Map<string, FailedMaterialInfo>();

  constructor(
    private eventBus: ResourceEventBus,
    private provider: ResourceProvider | null,
    private registry: ResourceRegistry
  ) {
    // Listen for resource:provided events to auto-retry failed materials
    this.eventBus.on<string>('resource', 'provided', (path) => {
      for (const [id, info] of this.failedMaterials) {
        if (info.metadata.path === path) {
          logger.info(`[MaterialLoader] Auto-retrying material ${id} after resource provided: ${path}`);
          this.retryFailed(id);
        }
      }
    });

    // Listen for texture:loaded events to retry failed materials
    // Only retry materials that are actually waiting for this specific texture
    this.eventBus.on<THREE.Texture>('texture', 'loaded', (textureId) => {
      if (this.failedMaterials.size === 0) return;

      for (const [id, info] of this.failedMaterials) {
        // Only retry if this material was waiting for this specific texture
        // or if we don't know what textures it needs (awaitingTextures is empty)
        if (info.awaitingTextures.size === 0 || info.awaitingTextures.has(textureId)) {
          logger.info(`[MaterialLoader] Retrying material ${id} after texture ${textureId} loaded`);
          this.retryFailed(id);
        }
      }
    });
  }

  /**
   * Extract texture references from material content without fully parsing.
   * Used to track dependencies for failed materials.
   */
  private extractTextureRefsFromContent(content: string): Set<string> {
    const refs = new Set<string>();

    // Match ExtResource references for texture properties
    // Pattern: property_texture = ExtResource("id")
    const textureProps = [
      'albedo_texture',
      'normal_texture',
      'metallic_texture',
      'roughness_texture',
      'ao_texture',
      'emission_texture',
    ];

    for (const prop of textureProps) {
      // Match: albedo_texture = ExtResource("1_abc") or ExtResource( "1_abc" )
      const regex = new RegExp(`${prop}\\s*=\\s*ExtResource\\s*\\(\\s*"([^"]+)"\\s*\\)`, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (match[1]) {
          refs.add(match[1]);
        }
      }
    }

    return refs;
  }

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

    // Set up promise FIRST to ensure handlers are registered before any sync events
    // This is critical because loadAsync may emit events synchronously (before first await)
    const resultPromise = this.eventBus
      .once<THREE.Material>('material', 'loaded', id)
      .catch(() => null);

    // Start loading (may emit events synchronously)
    this.request(id);

    // Wait for loaded or failed event
    return resultPromise;
  }

  private async loadAsync(id: string): Promise<void> {
    this.inflight.add(id);
    this.eventBus.emit('material', 'loading', id);
    const startTime = performance.now();

    // Track content for texture ref extraction on failure
    let materialContent: string | null = null;

    try {
      // Step 1: Load raw content first (so we have it for texture extraction if parsing fails)
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

      const content = await this.provider.loadResource(metadata.path, metadata.type);
      if (typeof content !== 'string') {
        throw new Error(`Material must be text content: ${metadata.path}`);
      }

      // Store content BEFORE parsing (so we can extract texture refs on failure)
      materialContent = content;

      // Step 2: Parse and create material
      const material = await this.parseMaterialContent(content);
      this.cache.set(id, material);
      this.inflight.delete(id);

      const elapsed = performance.now() - startTime;
      logger.info(`[MaterialLoader] Loaded: ${id} (${elapsed.toFixed(2)}ms)`);
      this.eventBus.emit<THREE.Material>('material', 'loaded', id, material);
    } catch (error) {
      this.cache.set(id, null); // Cache failure to prevent retries
      this.inflight.delete(id);

      // Track failed material for potential retry when resource is provided
      const metadata = this.metadataMap.get(id);
      if (metadata) {
        // Extract texture dependencies if we have content
        const awaitingTextures = materialContent
          ? this.extractTextureRefsFromContent(materialContent)
          : new Set<string>();

        this.failedMaterials.set(id, { metadata, awaitingTextures });

        if (awaitingTextures.size > 0) {
          logger.info(`[MaterialLoader] Material ${id} awaiting textures: ${[...awaitingTextures].join(', ')}`);
        }
      }

      const elapsed = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[MaterialLoader] Failed: ${id} (${elapsed.toFixed(2)}ms)`, err);
      this.eventBus.emit<Error>('material', 'failed', id, err);
    }
  }

  /**
   * Parse material content and create THREE.Material.
   */
  private async parseMaterialContent(content: string): Promise<THREE.Material> {
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
   * Load material from provider and return both material and raw content.
   * Content is needed for texture ref extraction on failure.
   */
  private async loadMaterialFromProviderWithContent(id: string): Promise<{ material: THREE.Material; content: string }> {
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

    return { material, content };
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
    this.failedMaterials.clear();
    logger.info('[MaterialLoader] Cleared all cache');
  }

  /**
   * Retry loading a previously failed material.
   * Used when a missing resource is provided by the user.
   */
  retryFailed(id: string): void {
    if (!this.failedMaterials.has(id)) {
      logger.info(`[MaterialLoader] No failed material to retry: ${id}`);
      return;
    }

    // Clear failed status and cache entry
    this.failedMaterials.delete(id);
    this.cache.delete(id);

    logger.info(`[MaterialLoader] Retrying failed material: ${id}`);
    this.request(id);
  }

  /**
   * Get map of failed materials (for debugging/recovery UI).
   * Returns just the metadata for backward compatibility.
   */
  getFailedMaterials(): Map<string, MaterialMetadata> {
    const result = new Map<string, MaterialMetadata>();
    for (const [id, info] of this.failedMaterials) {
      result.set(id, info.metadata);
    }
    return result;
  }

  /**
   * Get full failed material info including awaiting textures.
   * Use this for detailed debugging of texture dependencies.
   */
  getFailedMaterialsWithDependencies(): Map<string, FailedMaterialInfo> {
    return new Map(this.failedMaterials);
  }

  /**
   * Get the texture IDs a failed material is waiting for.
   * Returns empty set if material hasn't failed or has no known dependencies.
   */
  getAwaitingTextures(id: string): Set<string> {
    const info = this.failedMaterials.get(id);
    return info ? new Set(info.awaitingTextures) : new Set();
  }

  /**
   * Check if a material has failed to load.
   */
  hasFailed(id: string): boolean {
    return this.failedMaterials.has(id);
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
