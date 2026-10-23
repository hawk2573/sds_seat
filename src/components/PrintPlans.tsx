import React from 'react';
import {Assignment, FloorPlan, FloorPlanGeometry, Space} from '../types/domain';
import {getSpaceAvailability, indexAssignmentsBySpace} from '../services/assignmentEngine';
import {fitPlanRect, isFloorPlanImage, Size} from '../services/floorPlan';
import {orderMapGeometry} from '../services/geometry';
import {spacesForPlans} from '../services/planSelection';
import {GeometryShape, statusFor} from './FloorPlanCanvas';

export function PrintPlans({plans, spaces, spacesById, geometry, assignments, asOfDate, rangeEnd, availableOnly, imageSizes = {}, showLabels = false}: {
  plans: FloorPlan[]; spaces: Space[]; spacesById: ReadonlyMap<string, Space>; geometry: FloorPlanGeometry[];
  assignments: Assignment[]; asOfDate: string; rangeEnd?: string; availableOnly: boolean;
  imageSizes?: Readonly<Record<string, Size>>;
  showLabels?: boolean;
}) {
  const bySpace = indexAssignmentsBySpace(assignments);
  return <>{plans.filter(plan => isFloorPlanImage(plan.file)).map(plan => {
    const visibleIds = new Set(spacesForPlans(spaces, [plan], geometry, spacesById).map(space => space.id));
    const decoded = imageSizes[plan.file!.url];
    const width = decoded?.width || plan.file?.width || plan.originalWidth || 1000;
    const height = decoded?.height || plan.file?.height || plan.originalHeight || 1000;
    const landscape = width > height;
    const fitted = fitPlanRect({width: landscape ? 10.3 : 7.8, height: landscape ? 6.6 : 9.1}, {width, height});
    return <article key={plan.id} className={`print-plan ${landscape ? 'landscape' : 'portrait'}`}>
      <header><strong>{plan.name}</strong><span>Assignments as of {asOfDate}{availableOnly ? ` · Availability highlights through ${rangeEnd || asOfDate}` : ''}</span></header>
      <div className="print-plan-surface" style={{width: `${fitted.width}in`, height: `${fitted.height}in`}}>
        <img src={plan.file!.url} alt={plan.name} />
        <svg className="geometry-layer" viewBox="0 0 1 1" preserveAspectRatio="none" aria-label={`${plan.name} printed workstation status`}>
          {orderMapGeometry(geometry, spacesById).filter(item => item.floorPlanId === plan.id && item.visible).map(item => {
            const space = item.spaceId ? spacesById.get(item.spaceId) : undefined;
            if (space && !visibleIds.has(space.id)) return null;
            const assigned = space ? bySpace.get(space.id) || [] : [];
            if (availableOnly && (!space?.assignable || !getSpaceAvailability(space, assigned, {start: asOfDate, end: rangeEnd || asOfDate}).available)) return null;
            return <g key={item.id}><GeometryShape item={item} space={space} status={space ? statusFor(space, assigned, asOfDate) : 'issue'} selected={false} />
              {showLabels && space && item.type !== 'point' && <text x={item.labelX ?? item.x + item.width / 2} y={item.labelY ?? item.y + item.height / 2} textAnchor="middle" dominantBaseline="central">{space.shortLabel || space.roomNumber || space.name}</text>}
            </g>;
          })}
        </svg>
      </div>
      <div className="legend print-plan-legend"><span className="status-available">Available</span><span className="status-occupied">Assigned</span><span className="status-future">Starts later</span><span className="status-shared">Capacity available</span><span className="status-issue">Needs review</span></div>
      <p className="print-plan-note">Status colors apply to mapped records. Uncolored source desks do not indicate availability.</p>
    </article>;
  })}</>;
}
