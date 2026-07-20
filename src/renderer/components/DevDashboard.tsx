import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import {
  EmptyState,
} from './DevDashboardTaskUi';
import type { Message, Task, TaskStatus } from '../../shared/types';
import { extractToolItems } from '../utils/tool-pipeline/extractToolItems';
import { useAppContext } from '../contexts/AppContext';
import {
  ChangedFileRow,
  CollapsibleSection,
  ContextIllustration,
  ExternalResourceRow,
  FolderIllustration,
  PlanTimeline,
  TimelineTaskRow,
} from './dev-dashboard/components';
import RuntimeEnvironment from './dev-dashboard/RuntimeEnvironment';

interface DevDashboardProps {
  activeConversationId: string | null;
  activeProject: string | null;
  className?: string;
  messages?: Message[];
  style?: React.CSSProperties;
  onActiveTodoPresenceChange?: (hasActiveTodo: boolean) => void;
}

const DevDashboard: React.FC<DevDashboardProps> = ({
  activeConversationId,
  activeProject,
  className = '',
  messages = [],
  style,
  onActiveTodoPresenceChange,
}) => {
  const currentTasksApi = useTasks(activeProject, activeConversationId);
  const { setPreview } = useAppContext();

  const [todoCollapsed, setTodoCollapsed] = useState(false);

  const currentSessionTasks = useMemo(() => {
    if (!activeConversationId) return [];
    return currentTasksApi.tasks.filter((task) => task.conversationId === activeConversationId);
  }, [activeConversationId, currentTasksApi.tasks]);

  const allToolItems = useMemo(() => extractToolItems(messages), [messages]);

  const latestPlanUpdate = useMemo(() => {
    for (let index = allToolItems.length - 1; index >= 0; index -= 1) {
      const item = allToolItems[index];
      if (item.kind === 'plan_update') return item;
    }
    return null;
  }, [allToolItems]);

  const handleToggleTaskStatus = async (task: Task) => {
    if (task.status === 'completed' || task.status === 'cancelled') return;
    try {
      if (task.status === 'pending') {
        await currentTasksApi.update(task.id, { status: 'in_progress' as TaskStatus });
      }
      await currentTasksApi.update(task.id, { status: 'completed' as TaskStatus });
    } catch (err) {
      console.error('[DevDashboard] failed to complete task:', err);
    }
  };

  const changedFiles = useMemo(() => {
    const byPath = new Map<string, { path: string; name: string; diff?: string; label: string; isNew: boolean }>();
    for (const item of allToolItems) {
      if ((item.kind === 'write' || item.kind === 'edit') && item.status === 'done' && item.path) {
        const isNew = item.kind === 'write' && (item.isNew ?? false);
        const name = item.path.split('/').pop() || item.path;
        byPath.set(item.path, {
          path: item.path,
          name,
          diff: item.diff,
          label: item.kind === 'write' ? (isNew ? 'Creating' : 'Writing') : 'Editing',
          isNew,
        });
      }
    }
    return [...byPath.values()];
  }, [allToolItems]);

  const externalResources = useMemo(() => {
    const resourceMap = new Map<string, { key: string; name: string; type: 'search' | 'skill' | 'mcp'; status: string; detail?: string }>();

    for (const item of allToolItems) {
      const isValidStatus = item.status === 'done' || item.status === 'error' || item.status === 'running';
      if (!isValidStatus) continue;

      if (item.kind === 'web_search') {
        const key = `web_search__${item.query}`;
        resourceMap.set(key, {
          key,
          name: item.query,
          type: 'search',
          status: item.status,
        });
      } else if (item.kind === 'web_fetch') {
        const key = `web_fetch__${item.url}`;
        resourceMap.set(key, {
          key,
          name: item.url,
          type: 'search',
          status: item.status,
        });
      } else if (item.kind === 'tool') {
        if (item.toolName === 'load_skill') {
          let skillName = '';
          try {
            const parsed = JSON.parse(item.input);
            skillName = parsed.name || '';
          } catch {
            skillName = item.input || '';
          }
          if (skillName) {
            const key = `skill__${skillName}`;
            resourceMap.set(key, {
              key,
              name: skillName,
              type: 'skill',
              status: item.status,
            });
          }
        } else if (item.toolName.startsWith('mcp__')) {
          const parts = item.toolName.split('__');
          const toolName = parts[2] || '';
          const key = `mcp__${item.toolName}`;
          resourceMap.set(key, {
            key,
            name: toolName,
            type: 'mcp',
            status: item.status,
          });
        }
      }

      if (item.kind !== 'tool' && item.name.startsWith('mcp__')) {
        const parts = item.name.split('__');
        const toolName = parts[2] || '';
        const key = `mcp__${item.name}`;
        resourceMap.set(key, {
          key,
          name: toolName,
          type: 'mcp',
          status: item.status,
        });
      }
    }
    return [...resourceMap.values()];
  }, [allToolItems]);

  const filesCount = changedFiles.length;
  const resourcesCount = externalResources.length;
  const [filesCollapsed, setFilesCollapsed] = useState(() => filesCount === 0);
  const [resourcesCollapsed, setResourcesCollapsed] = useState(() => resourcesCount === 0);
  const previousFilesCount = useRef(filesCount);
  const previousResourcesCount = useRef(resourcesCount);
  const filesAutoExpanded = useRef(filesCount > 0);
  const resourcesAutoExpanded = useRef(resourcesCount > 0);

  useEffect(() => {
    setFilesCollapsed(filesCount === 0);
    setResourcesCollapsed(resourcesCount === 0);
    previousFilesCount.current = filesCount;
    previousResourcesCount.current = resourcesCount;
    filesAutoExpanded.current = filesCount > 0;
    resourcesAutoExpanded.current = resourcesCount > 0;
  }, [activeConversationId]);

  useEffect(() => {
    if (!filesAutoExpanded.current && previousFilesCount.current === 0 && filesCount > 0) {
      setFilesCollapsed(false);
      filesAutoExpanded.current = true;
    }
    previousFilesCount.current = filesCount;
  }, [filesCount]);

  useEffect(() => {
    if (!resourcesAutoExpanded.current && previousResourcesCount.current === 0 && resourcesCount > 0) {
      setResourcesCollapsed(false);
      resourcesAutoExpanded.current = true;
    }
    previousResourcesCount.current = resourcesCount;
  }, [resourcesCount]);

  const handleOpenFileDiff = (file: { path: string; name: string; diff?: string }) => {
    if (!file.diff) return;
    setPreview({
      type: 'diff',
      title: `${file.name} (diff)`,
      content: file.diff,
      filePath: file.path,
    });
  };

  const sortedSessionTasks = useMemo(() => {
    const inProgress = currentSessionTasks.filter(t => t.status === 'in_progress');
    const pending = currentSessionTasks.filter(t => t.status === 'pending');
    const completed = currentSessionTasks.filter(t => t.status === 'completed');
    const cancelled = currentSessionTasks.filter(t => t.status === 'cancelled');
    return [...inProgress, ...pending, ...completed, ...cancelled];
  }, [currentSessionTasks]);

  const hasActivePlan = latestPlanUpdate?.plan.some((item) => item.status !== 'completed') ?? false;
  const hasActiveSessionTask = currentSessionTasks.some(
    (task) => task.status === 'pending' || task.status === 'in_progress',
  );
  const hasActiveTodo = hasActivePlan || hasActiveSessionTask;
  const todoCount = (latestPlanUpdate?.plan.length ?? 0) + sortedSessionTasks.length;
  useEffect(() => {
    onActiveTodoPresenceChange?.(hasActiveTodo);
  }, [hasActiveTodo, onActiveTodoPresenceChange]);

  return (
    <aside
      aria-label="当前会话任务及资源"
      style={style}
      className={`bg-bg-main flex flex-col min-h-0 overflow-hidden font-sans text-text-primary transition-[width] duration-[220ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${className}`}
    >
      {           }
      <div className="flex flex-1 flex-col overflow-y-auto min-h-0 custom-scrollbar">
        <RuntimeEnvironment activeProject={activeProject} />
        {                   }
        <CollapsibleSection
          title="变更"
          meta={filesCount}
          testId="files"
          collapsed={filesCollapsed}
          onToggle={() => setFilesCollapsed(!filesCollapsed)}
          isEmpty={changedFiles.length === 0}
        >
          {changedFiles.length === 0 ? (
            <EmptyState
              illustration={<FolderIllustration />}
              title="暂无文件变更"
              description="本会话暂无修改或创建的文件。"
            />
          ) : (
            <div className="flex flex-col gap-0.5">
              {changedFiles.map((file) => (
                <ChangedFileRow
                  key={file.path}
                  file={file}
                  onClick={() => handleOpenFileDiff(file)}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {                        }
        <CollapsibleSection
          title="外部资源"
          meta={resourcesCount}
          testId="resources"
          collapsed={resourcesCollapsed}
          onToggle={() => setResourcesCollapsed(!resourcesCollapsed)}
          isEmpty={externalResources.length === 0}
        >
          {externalResources.length === 0 ? (
            <EmptyState
              illustration={<ContextIllustration />}
              title="暂无外部资源"
              description="本会话暂无使用网页搜索、MCP或技能。"
            />
          ) : (
            <div className="flex flex-col gap-1">
              {           }
              {(() => {
                const grouped = externalResources.reduce((acc, resource) => {
                  const type = resource.type;
                  if (!acc[type]) acc[type] = [];
                  acc[type].push(resource);
                  return acc;
                }, {} as Record<string, typeof externalResources>);

                const typeLabels: Record<string, string> = {
                  search: 'Connectors',
                  skill: 'Skills',
                  mcp: 'MCP',
                };

                return Object.entries(grouped).map(([type, resources], groupIndex) => (
                  <div key={type} className="flex flex-col">
                    <div className={`px-2.5 pb-1 text-[12px] font-medium text-text-tertiary ${groupIndex > 0 ? 'pt-3' : 'pt-0'}`}>
                      {typeLabels[type] || type}
                    </div>
                    {resources.map((resource) => (
                      <ExternalResourceRow
                        key={resource.key}
                        resource={resource}
                      />
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}
        </CollapsibleSection>

        {                                }
        {hasActiveTodo ? (
          <CollapsibleSection
            title="待办事项"
            meta={todoCount}
            testId="todo"
            collapsed={todoCollapsed}
            onToggle={() => setTodoCollapsed(!todoCollapsed)}
          >
            <div className="flex flex-col gap-0.5">
              {latestPlanUpdate && <PlanTimeline planUpdate={latestPlanUpdate} />}
              {latestPlanUpdate && sortedSessionTasks.length > 0 && (
                <div className="mx-3 my-2 border-t border-hairline" />
              )}
              {latestPlanUpdate && sortedSessionTasks.length > 0 && (
                <div className="px-3 pb-1 text-[12px] font-normal text-text-tertiary">
                  任务记录
                </div>
              )}
              {sortedSessionTasks.map((task) => (
                <TimelineTaskRow
                  key={task.id}
                  task={task}
                  onClick={() => handleToggleTaskStatus(task)}
                />
              ))}
            </div>
          </CollapsibleSection>
        ) : null}
      </div>
    </aside>
  );
};

export default React.memo(DevDashboard);
