import type { ActiveRequest } from './types';

interface MessagesHotData {
  activeRequests?: Map<string, ActiveRequest>;
}

interface ViteHotContext {
  data: MessagesHotData;
  dispose: (callback: (data: MessagesHotData) => void) => void;
}

const viteHot = (import.meta as ImportMeta & { hot?: ViteHotContext }).hot;
const hotData = viteHot?.data;

export const activeRequestRegistry = hotData?.activeRequests ?? new Map<string, ActiveRequest>();

viteHot?.dispose((data: MessagesHotData) => {
  data.activeRequests = activeRequestRegistry;
});
