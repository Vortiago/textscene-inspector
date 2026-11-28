import { joinBuildLock } from './buildLock.mjs';

const ownerPath = process.env.TEXTSCENE_PREVIEW_LOCK_OWNER;
if (ownerPath) {
  const release = joinBuildLock(ownerPath);
  process.env.TEXTSCENE_PREVIEW_LOCK_OWNER = release.ownerPath;
  // Keep the record until the kernel closes the orphan's listening socket and its pid disappears.
  if (process.env.TEXTSCENE_PREVIEW_SERVER === '1') {
    delete process.env.TEXTSCENE_PREVIEW_SERVER;
    const stopOrphan = () => process.kill(process.pid, 'SIGKILL');
    process.once('disconnect', stopOrphan);
    if (!process.connected) stopOrphan();
  }
}
