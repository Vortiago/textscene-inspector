import { DEFAULT_ROOT_SCENE_PATH } from '../../../scene/openScene';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import { useOpenedScene } from '../../testing/useOpenedScene';
import { TscnPreviewShell } from './TscnPreviewShell';
import type { TscnPreviewShellProps } from './previewShellProps';

interface TextShellProps extends Omit<TscnPreviewShellProps, 'scene'> {
  content: string;
  rootScenePath?: string;
  /** Without it, a loader above the shell serves the files, or none does. */
  provider?: ResourceProvider;
}

/** The shell over a scene that opens from `content` and follows it, as an app opens its own. */
export function TextShell({
  content,
  rootScenePath = DEFAULT_ROOT_SCENE_PATH,
  provider,
  ...props
}: TextShellProps) {
  return <TscnPreviewShell scene={useOpenedScene(content, rootScenePath, provider)} {...props} />;
}
