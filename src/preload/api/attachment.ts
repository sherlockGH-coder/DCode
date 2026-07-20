import { ipcRenderer } from 'electron';
import type { Attachment } from '../../shared/types';

export const attachmentApi = {
  /** 弹出系统多选文件对话框，返回 Attachment[]（用户取消返回空数组） */
  pickFiles: (): Promise<Attachment[]> => {
    return ipcRenderer.invoke('dialog:openFiles');
  },

  /** 校验单个路径并返回 Attachment（拖拽 / 粘贴路径用），不存在或非文件返回 null */
  statPath: (path: string): Promise<Attachment | null> => {
    return ipcRenderer.invoke('fs:statPath', path);
  },

  /** 从系统剪贴板读取图片并保存为临时文件后返回 Attachment；无图片返回 null */
  pasteClipboardImage: (): Promise<Attachment | null> => {
    return ipcRenderer.invoke('clipboard:pasteImage');
  },

  /** 读取文件内容（工作区预览用） */
  readFileContent: (filePath: string): Promise<{ content: string; name: string; path: string } | null> => {
    return ipcRenderer.invoke('fs:readFile', filePath);
  },
};
