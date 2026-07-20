import { ToolRegistry } from './types';
import { readFileTool } from './readFile';
import { writeFileTool } from './writeFile';
import { bashExecTool } from './bashExec';
import { editFileTool } from './editFile';
import { grepTool } from './grep';
import { globTool } from './glob';
import { webSearchTool } from './webSearch';
import { webFetchTool } from './webFetch';
import { askUserQuestionTool } from './askUserQuestion';
import { updatePlanTool } from './updatePlan';
import { submitPlanTool } from './submitPlan';
import {
  closeAgentTool,
  listAgentsTool,
  sendAgentInputTool,
  spawnAgentTool,
  waitAgentTool,
} from './agentTools';

export const toolRegistry = new ToolRegistry();

toolRegistry.register(readFileTool);
toolRegistry.register(writeFileTool);
toolRegistry.register(bashExecTool);
toolRegistry.register(editFileTool);
toolRegistry.register(grepTool);
toolRegistry.register(globTool);
toolRegistry.register(webSearchTool);
toolRegistry.register(webFetchTool);
toolRegistry.register(askUserQuestionTool);
toolRegistry.register(updatePlanTool);
toolRegistry.register(submitPlanTool);
toolRegistry.register(spawnAgentTool);
toolRegistry.register(waitAgentTool);
toolRegistry.register(sendAgentInputTool);
toolRegistry.register(listAgentsTool);
toolRegistry.register(closeAgentTool);
