import os from 'node:os';

export function getOSInfo(): string {
  const platformMap: Record<string, string> = {
    darwin: 'macOS',
    linux: 'Linux',
    win32: 'Windows'
  };

  const platformName = platformMap[os.platform()] || os.platform();
  return `${platformName} ${os.release()} (${os.arch()})`;
}
