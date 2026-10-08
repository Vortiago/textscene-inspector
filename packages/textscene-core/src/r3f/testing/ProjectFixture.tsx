/** A test wrapper that serves one `project.godot` to the project settings, or none. */
import type { ReactNode } from 'react';
import { FileEventBus } from '../../resources/FileEventBus';
import { ResourceLoader } from '../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import { PROJECT_FILE_PATH } from '../../godot/project.js';
import { ProjectSettingsProvider } from '../contexts/ProjectSettingsContext';

/** Wraps `children` under a project whose `project.godot` is `project`, or under no project for null. */
export function withProject(project: string | null) {
  const provider: ResourceProvider = {
    async loadResource(path: string) {
      if (path !== PROJECT_FILE_PATH || project === null) throw new Error(`Resource not found: ${path}`);
      return project;
    },
  };
  const loader = new ResourceLoader(new FileEventBus(provider));
  loader.setProvider(provider);
  return function ProjectFixture({ children }: { children: ReactNode }) {
    return (
      <ResourceLoaderProvider loader={loader}>
        <ProjectSettingsProvider>{children}</ProjectSettingsProvider>
      </ResourceLoaderProvider>
    );
  };
}
