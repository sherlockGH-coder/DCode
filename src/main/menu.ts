import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { createMainWindow } from './windowManager';

function openNewWindow(): void {
  const win = createMainWindow();
  win.show();
  win.focus();
}

export function setupApplicationMenu(): void {
  const isMacOS = process.platform === 'darwin';

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: openNewWindow,
      },
      { type: 'separator' },
      { role: 'close', label: 'Close Window' },
      ...(!isMacOS ? [{ role: 'quit' as const, label: 'Quit' }] : []),
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMacOS
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    fileMenu,
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://www.electronjs.org');
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
