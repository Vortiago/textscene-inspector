/**
 * Drag-and-drop of files onto the whole app root.
 */

import { useRef, useState, type DragEvent as ReactDragEvent } from 'react';

export interface FileDrop {
  dragActive: boolean;
  handleDragEnter: (e: ReactDragEvent) => void;
  handleDragOver: (e: ReactDragEvent) => void;
  handleDragLeave: (e: ReactDragEvent) => void;
  handleDrop: (e: ReactDragEvent) => void;
}

export function useFileDrop(onFiles: (files: readonly File[]) => void): FileDrop {
  // Drag-and-drop a .tscn (+ resource files) onto the page. A counter,
  // not a boolean, because dragenter/dragleave bubble from every descendant
  // as the cursor crosses child element boundaries during one continuous
  // drag over the app root — only net-zero really means "left the window".
  const dragCounterRef = useRef(0);
  const [dragActive, setDragActive] = useState(false);

  // A drag carrying no files is someone else's — dragging a selection inside
  // the Source textarea to move it is the everyday case. `preventDefault()`
  // cancels the browser's own handling of it, so the check comes FIRST in
  // every handler that calls it.
  function carriesFiles(e: ReactDragEvent): boolean {
    return e.dataTransfer.types.includes('Files');
  }

  function handleDragEnter(e: ReactDragEvent) {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setDragActive(true);
  }

  // Required so the browser's default "reject the drop" behavior doesn't
  // win — without this, `onDrop` never fires.
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
