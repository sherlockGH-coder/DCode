import React from 'react';
import type { Message } from '../../shared/types';
import { useToolRenderUnits } from '../hooks/useToolRenderUnits';
import RenderUnitView from './RenderUnitView';

interface ToolActivityProps {
  messages: Message[];
}

const ToolActivity: React.FC<ToolActivityProps> = ({ messages }) => {
  const { units } = useToolRenderUnits(messages);

  if (units.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {units.map((unit, i) => (
        <RenderUnitView key={`unit-${i}`} unit={unit} />
      ))}
    </div>
  );
};

export default ToolActivity;
