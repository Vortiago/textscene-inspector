/** Drag-and-drop of files onto the whole app root. */

import { useRef, useState, type DragEvent as ReactDragEvent } from 'react';

export interface FileDrop {
  dragActive: boolean;
  handleDragEnter: (e: ReactDragEvent) => void;
  handleDragOver: (e: ReactDragEvent) => void;
  handleDragLeave: (e: ReactDragEvent) => void;
  handleDrop: (e: ReactDragEvent) => void;
}

export function useFileDrop(onFiles: (files: readonly File[]) => void): FileDrop {
  // A counter, not a boolean: dragenter and dragleave bubble from every descendant the
  // cursor crosses, so only net zero means the drag left the window.
  const dragCounterRef = useRef(0);
  const [dragActive, setDragActive] = useState(false);

  // A drag with no files belongs to someone else, such as a selection moved inside the Source
  // textarea. `preventDefault()` cancels the browser's own handling, so this check comes first
  // in every handler that calls it.
  function carriesFiles(e: ReactDragEvent): boolean {
    return e.dataTransfer.types.includes('Files');
  }

  function handleDragEnter(e: ReactDragEvent) {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setDragActive(true);
  }

  // Without this, the browser rejects the drop and `onDrop` never fires.
  function handleDragOver(e: ReactDragEvent) {
    if (!carriesFiles(e)) return;
    e.preventDefault();
  }

  function handleDragLeave(e: ReactDragEvent) {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragActive(false);
  }

  function handleDrop(e: ReactDragEvent) {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragActive(false);
    onFiles(Array.from(e.dataTransfer.files));
  }

  return { dragActive, handleDragEnter, handleDragOver, handleDragLeave, handleDrop };
}
