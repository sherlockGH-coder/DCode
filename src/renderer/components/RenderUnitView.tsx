import React from 'react';
import type { RenderUnit } from '../utils/tool-pipeline';
import ToolItemCard from './ToolItemCard';
import ExplorationGroup from './ExplorationGroup';
import CollapsedSegment from './CollapsedSegment';

interface RenderUnitViewProps {
  unit: RenderUnit;
  hideIcon?: boolean;
}

const RenderUnitView: React.FC<RenderUnitViewProps> = ({ unit, hideIcon = false }) => {
  switch (unit.kind) {
    case 'entry':
      return <ToolItemCard item={unit.item} hideIcon={hideIcon} />;

    case 'exploration-group':
      return <ExplorationGroup items={unit.items} summary={unit.summary} defaultCollapsed={unit.defaultCollapsed} hideIcon={hideIcon} />;

    case 'collapsed-segment':
      return <CollapsedSegment units={unit.units} summary={unit.summary} />;

    case 'expanded-segment':
      return (
        <div className="flex flex-col gap-0.5">
          {unit.units.map((child, i) => (
            <RenderUnitView key={`expanded-unit-${unit.segmentIndex}-${i}`} unit={child} hideIcon={hideIcon} />
          ))}
        </div>
      );

    default:
      return null;
  }
};

export default React.memo(RenderUnitView);
