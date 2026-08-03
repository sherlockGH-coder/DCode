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
  prompt: string;
  title: string;
  description: string[];
  accent: 'blue' | 'violet' | 'orange' | 'green';
  icon: React.ReactNode;
};

const actions: WelcomeAction[] = [
  {
    prompt: 'Explore and analyze the architecture and core implementation of this codebase',
    title: 'Explore',
    description: ['Explore and understand the codebase', 'or product documentation'],
    accent: 'blue',
    icon: <IconSearch size={42} className="welcome-action-icon" />,
  },
  {
    prompt: 'Build a new feature module:',
    title: 'Build',
    description: ['Build new features, apps,', 'or tools'],
    accent: 'violet',
    icon: <IconCube size={44} className="welcome-action-icon" />,
  },
  {
    prompt: 'Inspect and fix issues in the code:',
    title: 'Fix',
    description: ['Debug errors, optimize code,', 'or fix issues'],
    accent: 'orange',
    icon: <IconWrench size={43} className="welcome-action-icon" />,
  },
  {
    prompt: 'Review recent code changes and suggest improvements',
    title: 'Review',
    description: ['Review code changes and provide', 'improvement suggestions'],
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
        <span>What do you want to </span>
        <span className="welcome-title-accent">build?</span>
      </h1>
      <p>From idea to implementation, AI works with you</p>
    </header>

    <div className="welcome-actions" role="list" aria-label="Quick starts">
      {actions.map((action) => (
        <div key={action.title} role="listitem" className={`welcome-action-wrap welcome-action-${action.accent}`}>
          <button
            type="button"
            className="welcome-action-card"
            onClick={() => onQuickAction(action.prompt)}
            aria-label={`${action.title}: ${action.prompt}`}
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
