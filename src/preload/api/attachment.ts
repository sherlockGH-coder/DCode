import { ipcRenderer } from 'electron';
import type { Attachment } from '../../shared/types';

export const attachmentApi = {
  /** Open the system multi-file dialog and return Attachment[]; return an empty array when cancelled. */
  pickFiles: (): Promise<Attachment[]> => {
    return ipcRenderer.invoke('dialog:openFiles');
  },

  /** Validate one path and return an Attachment for dragged or pasted paths; return null when missing or not a file. */
  statPath: (path: string): Promise<Attachment | null> => {
    return ipcRenderer.invoke('fs:statPath', path);
  },

  /** Read an image from the system clipboard, save it as a temporary file, and return an Attachment; return null when there is no image. */
  pasteClipboardImage: (): Promise<Attachment | null> => {
    return ipcRenderer.invoke('clipboard:pasteImage');
  },

  /** Read file contents for workspace previews. */
  readFileContent: (filePath: string): Promise<{ content: string; name: string; path: string } | null> => {
    return ipcRenderer.invoke('fs:readFile', filePath);
  },
};
