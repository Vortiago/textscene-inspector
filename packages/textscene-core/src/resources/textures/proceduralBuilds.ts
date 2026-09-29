/**
 * The async seam for a procedural texture that builds as a worker job. A lookup
 * is ready from the cache, or pending with a build its holders start and
 * release. A build is keyed on its content, not its scene, so an edit that
 * leaves a texture unchanged reuses it instead of building it again.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../parser/types';
import type { WorkerJobRunner } from '../../workers/WorkerJobRunner';
import type { WorkerJobInput, WorkerJobName, WorkerJobOutput } from '../../workers/jobs';
import { findSubResource, parseResourceReference } from '../SubResourceResolver';
import { unlessAllocationFails } from './pixelAllocation';
import { cachedProceduralTexture, cacheProceduralTexture } from './proceduralTextureCache';
import { beginTextureWork } from './textureWork';

export type JobRunner = Pick<WorkerJobRunner, 'run'>;

/** What a slice builds for one sub-resource: the job, and how its output becomes a texture. */
export interface ProceduralBuildPlan<Name extends WorkerJobName = WorkerJobName> {
  job: Name;
  input: WorkerJobInput<Name>;
  /** Equal for equal pixels, whatever file or id the texture came from. */
  contentKey: string;
  wrap(output: WorkerJobOutput<Name>): THREE.Texture;
}

/** A holder's share of a build. Release it when the texture is no longer wanted. */
export interface ProceduralBuildHandle {
  /** The built texture, or null when the build was aborted or could not be allocated. */
  settled: Promise<THREE.Texture | null>;
  release(): void;
}

export type ProceduralTextureLookup =
  | { status: 'ready'; texture: THREE.Texture; key: string }
  | { status: 'pending'; key: string; start(runner: JobRunner): ProceduralBuildHandle };

interface Build {
  holders: number;
  settled: Promise<THREE.Texture | null>;
  controller: AbortController;
}

/** Written by `joinBuild`. An entry leaves when its build settles or its last holder aborts it. */
const builds = new Map<string, Build>();

/**
 * Resolves `ref` as an inline `[sub_resource]` of `typeName`. Null for every other
 * reference form, and for a resource the plan declines, which leaves the caller's
 * other paths untouched. A ready texture is borrowed: pin `key`, never dispose it.
 */
export function resolveProceduralSubResourceAsync(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  typeName: string,
  plan: (
    properties: Record<string, string>,
    resources: readonly TscnInternalResource[]
  ) => ProceduralBuildPlan | null
): ProceduralTextureLookup | null {
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== typeName) return null;
  const build = plan(resource.data as Record<string, string>, internalResources);
  if (!build) return null;

  const key = build.contentKey;
  const texture = cachedProceduralTexture(key);
  if (texture) return { status: 'ready', texture, key };
  const label = `[${typeName}] sub-resource "${parsed.id}"`;
  return { status: 'pending', key, start: (runner) => joinBuild(key, build, label, runner) };
}

function joinBuild(
  key: string,
  plan: ProceduralBuildPlan,
  label: string,
  runner: JobRunner
): ProceduralBuildHandle {
  const build = builds.get(key) ?? startBuild(key, plan, label, runner);
  build.holders += 1;
  let released = false;
  return {
    settled: build.settled,
    release: () => {
      if (released) return;
      released = true;
      build.holders -= 1;
      // A microtask, not now: StrictMode and a re-render release and take a build
      // again in one task, and that must not cancel it.
      queueMicrotask(() => {
        if (build.holders > 0 || builds.get(key) !== build) return;
        builds.delete(key);
        build.controller.abort();
      });
    },
  };
}

function startBuild(key: string, plan: ProceduralBuildPlan, label: string, runner: JobRunner): Build {
  const controller = new AbortController();
  const endWork = beginTextureWork();
  const settled = runner.run(plan.job, plan.input, controller.signal).then(
    (output) => {
      const texture = plan.wrap(output);
      cacheProceduralTexture(key, texture);
      return texture;
    },
    (error: unknown) => {
      if (controller.signal.aborted) return null;
      return unlessAllocationFails(label, () => {
        throw error;
      });
    }
  );
  const build: Build = { holders: 0, settled, controller };
  builds.set(key, build);
  const finish = () => {
    if (builds.get(key) === build) builds.delete(key);
    // One microtask later: a holder's callback on `settled`, queued ahead of this one,
    // takes the work over first, so the count never reads zero between the two.
    queueMicrotask(endWork);
  };
  settled.then(finish, finish);
  return build;
}

/** Test seam: abort every build in flight and forget it. */
export function abortProceduralBuilds(): void {
  for (const build of builds.values()) build.controller.abort();
  builds.clear();
}
