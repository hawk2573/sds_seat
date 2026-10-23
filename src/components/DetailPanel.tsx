import React from 'react';
import {Assignment, Person, ProgramUnit, Space} from '../types/domain';
import {assignmentConsumesCapacity, getAssignmentsActiveOnDate, getAssignmentsNeedingDateReview, getSpaceAssignmentHistory, isAssignmentOperational} from '../services/assignmentEngine';
import {
  getEffectiveZone,
  getEffectiveZoneOwnerProgramUnitId,
  getSpacePath,
  normalizeSpaceKind,
  SpaceIndex,
} from '../services/spaceHierarchy';
import {StatusBadge} from './StatusBadge';

interface Props {
  space?: Space;
  assignments: Assignment[];
  spacesById: SpaceIndex;
  peopleById: Map<string, Person>;
  programsById: Map<string, ProgramUnit>;
  asOfDate: string;
  readOnly: boolean;
  onClose(): void;
  onAssign(): void;
  onMove(assignment: Assignment): void;
  onEnd(assignment: Assignment): void;
  onSelectSpace?(id: string): void;
}

export function DetailPanel({space, assignments, spacesById, peopleById, programsById, asOfDate, readOnly, onClose, onAssign, onMove, onEnd, onSelectSpace}: Props) {
  if (!space) return <aside className="detail-panel empty"><h2>Select a space</h2><p>Choose a mapped area to see current, future, and historical assignments.</p></aside>;
  const history = getSpaceAssignmentHistory(assignments, space.id);
  const active = getAssignmentsActiveOnDate(history, asOfDate).filter(item => !space.assignable || assignmentConsumesCapacity(item));
  const future = history.filter(item => isAssignmentOperational(item) && (!space.assignable || assignmentConsumesCapacity(item)) && item.startDate && item.startDate > asOfDate);
  const needsReview = getAssignmentsNeedingDateReview(history).length > 0;
  const status = !space.active ? 'inactive' : needsReview ? 'issue' : active.length ? (active.length < space.assignmentCapacity && space.assignmentMode === 'shared' ? 'shared' : 'occupied') : future.length ? 'future' : 'available';
  const zone = getEffectiveZone(space, spacesById);
  const zoneOwnerId = getEffectiveZoneOwnerProgramUnitId(space, spacesById);
  const children = [...spacesById.values()].filter(item => item.active && item.parentSpaceId === space.id)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
  const hierarchy = getSpacePath(space, spacesById)
    .filter(item => !['building', 'floor'].includes(normalizeSpaceKind(item.type)))
    .map(item => item.shortLabel || item.name)
    .join(' › ');
  return <aside className="detail-panel">
    <div className="detail-header"><div><p className="eyebrow">{space.type || 'Space'}</p><h2>{space.name}</h2><p className="muted">{[space.spaceId, space.roomNumber, space.level].filter(Boolean).join(' · ')}</p></div><button className="icon-button" aria-label="Close details" onClick={onClose}>×</button></div>
    {hierarchy && hierarchy !== (space.shortLabel || space.name) && <p className="muted" aria-label="Space hierarchy">{hierarchy}</p>}
    {space.assignable && <StatusBadge status={status} />}
    {space.assignable && needsReview && <p className="warning-text" role="alert">Assignment dates need review. Check the history below before assigning this workstation.</p>}
    <dl className="detail-list">
      <div><dt>Workspace area</dt><dd>{zone?.name || 'Not assigned to an area'}</dd></div>
      <div><dt>Area owner</dt><dd>{zoneOwnerId ? programsById.get(zoneOwnerId)?.name || 'Linked record unavailable' : zone ? 'Unowned' : 'Not set'}</dd></div>
      <div><dt>Primary function</dt><dd>{space.primaryFunction || 'Not set'}</dd></div>
      {space.assignable && <div><dt>Assignment mode</dt><dd>{space.assignmentMode} · capacity {space.assignmentMode === 'exclusive' ? 1 : space.assignmentCapacity}</dd></div>}
      {space.accessSensitivity && <div><dt>Access</dt><dd>{space.accessSensitivity}</dd></div>}
    </dl>
    {!readOnly && space.active && space.assignable && <div className="panel-actions"><button className="button primary" onClick={onAssign}>Assign person</button></div>}
    {readOnly && <p className="read-only-note">Read-only access: search, map, and history remain available.</p>}
    {children.length > 0 && <section className="panel-section"><h3>In this area</h3><div className="area-space-list">{children.map(item => <button className="text-button" key={item.id} disabled={!onSelectSpace} onClick={() => onSelectSpace?.(item.id)}>{item.shortLabel || item.name}</button>)}</div></section>}
    {(space.assignable || history.length > 0) && <>
      <section className="panel-section"><h3>On {asOfDate}</h3>{active.length ? active.map(item => <AssignmentRow key={item.id} item={item} person={item.personId ? peopleById.get(item.personId) : undefined} readOnly={readOnly} onMove={() => onMove(item)} onEnd={() => onEnd(item)} />) : <p className="empty-copy">{needsReview ? "Current occupancy cannot be confirmed until assignment dates are reviewed." : "No one is assigned on this date."}</p>}</section>
      <section className="panel-section"><h3>Starting later</h3>{future.length ? future.slice(0, 5).map(item => <AssignmentRow key={item.id} item={item} person={item.personId ? peopleById.get(item.personId) : undefined} readOnly={readOnly} onMove={() => onMove(item)} onEnd={() => onEnd(item)} />) : <p className="empty-copy">No later assignments.</p>}</section>
      <section className="panel-section"><h3>Assignment history</h3>{history.length ? history.map(item => <div className="timeline-row" key={item.id}><span className="timeline-date">{item.startDate || 'Missing date'} → {item.actualEndDate || item.expectedEndDate || 'present'}</span><strong>{item.personId ? peopleById.get(item.personId)?.name || 'Missing person' : 'No person'}</strong><span>{item.relationshipType}</span></div>) : <p className="empty-copy">No assignment history.</p>}</section>
      {(active.some(item => item.keyRequired || item.cardAccessRequired)) && <section className="panel-section"><h3>Access requirements</h3>{active.map(item => <div key={item.id}>{item.keyRequired && <p>Physical key: Required — {item.accessCompleted ? 'complete' : 'pending'}</p>}{item.cardAccessRequired && <p>Card access: Required — {item.accessCompleted ? 'complete' : 'pending'}</p>}</div>)}</section>}
    </>}
  </aside>;
}

function AssignmentRow({item, person, readOnly, onMove, onEnd}: {item: Assignment; person?: Person; readOnly: boolean; onMove(): void; onEnd(): void}) {
  return <article className="assignment-row"><strong>{person?.name || 'Missing person'}</strong><span>{item.startDate || 'Missing start'} → {item.actualEndDate || item.expectedEndDate || 'open-ended'}</span><span>{item.relationshipType}</span>{!readOnly && <div><button className="text-button" onClick={onMove}>Move</button><button className="text-button danger" onClick={onEnd}>End</button></div>}</article>;
}
