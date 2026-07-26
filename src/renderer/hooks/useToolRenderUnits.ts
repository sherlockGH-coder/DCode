import { useMemo } from 'react';
import type { Message } from '../../shared/types';
import { pipeline, type PipelineResult } from '../utils/tool-pipeline';

export function useToolRenderUnits(messages: Message[], isGenerating?: boolean): PipelineResult {
  return useMemo(() => pipeline(messages, isGenerating), [messages, isGenerating]);
}
