import os from 'node:os';

/**
 * 获取并格式化当前本地时间。
 * 使用 'sv-SE' 区域设置以获得 YYYY-MM-DD HH:mm:ss 格式，并附加 UTC 偏移量。
 *
 * @example
 * // 返回类似 "2026-06-17 14:30:00 (UTC+08:00)"
 * formatCurrentTime();
 *
 * @returns {string} 格式化后的本地时间字符串
 */
export function formatCurrentTime(): string {
  const now = new Date();
  const timeStr = now.toLocaleString('sv-SE', {
    timeZoneName: 'short'
  });

  const tzOffset = -now.getTimezoneOffset();
  const tzHours = Math.floor(Math.abs(tzOffset) / 60);
  const tzMinutes = Math.abs(tzOffset) % 60;
  const tzSign = tzOffset >= 0 ? '+' : '-';
  const tzStr = `UTC${tzSign}${String(tzHours).padStart(2, '0')}:${String(tzMinutes).padStart(2, '0')}`;

  return `${timeStr} (${tzStr})`;
}

/**
 * 获取当前操作系统的详细描述信息。
 *
 * @example
 * // 返回类似 "macOS 15.0.0 (arm64)"
 * getOSInfo();
 *
 * @returns {string} 格式化后的系统信息字符串
 */
export function getOSInfo(): string {
  const platformMap: Record<string, string> = {
    darwin: 'macOS',
    linux: 'Linux',
    win32: 'Windows'
  };

  const platformName = platformMap[os.platform()] || os.platform();
  return `${platformName} ${os.release()} (${os.arch()})`;
}
