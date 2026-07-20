import React from 'react';
import {
  IconCheck,
  IconCube,
  IconSearch,
  IconShield,
  IconWrench,
} from './icons';

interface WelcomePanelProps {
  onQuickAction: (command: string) => void;
}

type WelcomeAction = {
  command: string;
  title: string;
  description: string[];
  accent: 'blue' | 'violet' | 'orange' | 'green';
  icon: React.ReactNode;
};

const actions: WelcomeAction[] = [
  {
    command: '/explore',
    title: '探索',
    description: ['探索和理解代码库', '或产品文档'],
    accent: 'blue',
    icon: <IconSearch size={42} className="welcome-action-icon" />,
  },
  {
    command: '/build',
    title: '构建',
    description: ['构建新功能、应用', '或工具'],
    accent: 'violet',
    icon: <IconCube size={44} className="welcome-action-icon" />,
  },
  {
    command: '/fix',
    title: '修复',
    description: ['调试错误、优化代码', '或修复问题'],
    accent: 'orange',
    icon: <IconWrench size={43} className="welcome-action-icon" />,
  },
  {
    command: '/review',
    title: '审查',
    description: ['审查代码变更并提供', '改进建议'],
    accent: 'green',
    icon: (
      <span className="welcome-review-icon">
        <IconShield size={43} className="welcome-action-icon" />
        <IconCheck size={15} className="welcome-review-check" />
      </span>
    ),
  },
];

const WelcomePanel: React.FC<WelcomePanelProps> = ({ onQuickAction }) => (
  <div className="welcome-content">
    <header className="welcome-hero">
      <h1>
        <span>准备</span>
        <span className="welcome-title-accent">构建</span>
        <span>什么？</span>
      </h1>
      <p>从想法到实现，AI 与你一起完成</p>
    </header>

    <div className="welcome-actions" role="list" aria-label="快捷开始">
      {actions.map((action) => (
        <div key={action.command} role="listitem" className={`welcome-action-wrap welcome-action-${action.accent}`}>
          <button
            type="button"
            className="welcome-action-card"
            onClick={() => onQuickAction(action.command)}
            aria-label={`${action.title}：${action.command}`}
          >
            <span className="welcome-action-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="welcome-action-art" aria-hidden="true">
              {action.icon}
            </span>
            <span className="welcome-action-title">{action.title}</span>
            <span className="welcome-action-description">
              {action.description.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </button>
        </div>
      ))}
    </div>
  </div>
);

export default WelcomePanel;
