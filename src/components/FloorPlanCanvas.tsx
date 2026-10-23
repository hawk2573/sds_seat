import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Assignment, FloorPlan, FloorPlanGeometry, Point, Space} from '../types/domain';
import {assignmentConsumesCapacity, getAssignmentsActiveOnDate, getAssignmentsNeedingDateReview, getSpaceAvailability, indexAssignmentsBySpace, isAssignmentOperational} from '../services/assignmentEngine';
import {SpaceStatus} from './StatusBadge';
import {fitPlanRect, isFloorPlanImage, pointOnPlan, Size} from '../services/floorPlan';
import {moveGeometry, orderMapGeometry} from '../services/geometry';

interface FloorPlanCanvasProps {
  plan?: FloorPlan;
  spaces: Space[];
  assignments: Assignment[];
  geometry: FloorPlanGeometry[];
  visibleSpaceIds?: ReadonlySet<string>;
  asOfDate: string;
  rangeEnd?: string;
  selectedSpaceId?: string;
  editMode: boolean;
  tool: 'select' | 'point' | 'rectangle' | 'polygon';
  newSpaceId?: string;
  availableOnly?: boolean;
  showLabels?: boolean;
  onOpenPlan?(): void;
  onSelect(spaceId?: string): void;
  onGeometryChange(item: FloorPlanGeometry): void;
  onCreate(type: 'point' | 'rectangle' | 'polygon', point: Point, points?: Point[]): void;
}

export function statusFor(space: Space, assignments: Assignment[], asOfDate: string): SpaceStatus {
  if (!space.active) return 'inactive';
  if (getAssignmentsNeedingDateReview(assignments).some(item => item.spaceId === space.id)) return 'issue';
  const active = getAssignmentsActiveOnDate(assignments, asOfDate).filter(item => item.spaceId === space.id && assignmentConsumesCapacity(item));
  if (active.length >= (space.assignmentMode === 'exclusive' ? 1 : space.assignmentCapacity)) return 'occupied';
  if (active.length) return 'shared';
  const future = assignments.some(item => item.spaceId === space.id && isAssignmentOperational(item) && assignmentConsumesCapacity(item) && item.startDate && item.startDate > asOfDate);
  return future ? 'future' : 'available';
}

const STATUS_LABELS: Record<SpaceStatus, string> = {
  available: 'Available',
  occupied: 'Assigned now',
  future: 'Starts later',
  shared: 'Capacity available',
  ending: 'Ending soon',
  issue: 'Needs review',
  inactive: 'Inactive',
};

export function GeometryShape({item, space, status, selected}: {item: FloorPlanGeometry; space?: Space; status: SpaceStatus; selected: boolean}) {
  const className = `map-shape map-${space && !space.assignable ? 'area' : status}${selected ? ' selected' : ''}`;
  const title = `${space?.name || 'Unlinked geometry'} — ${space && !space.assignable ? 'Area / room' : STATUS_LABELS[status]}`;
  if (item.type === 'point') return <g className={className}><circle cx={item.x} cy={item.y} r="0.012" /><path d={`M ${item.x} ${item.y + 0.025} L ${item.x - 0.01} ${item.y + 0.008} L ${item.x + 0.01} ${item.y + 0.008} Z`} /><title>{title}</title></g>;
  if (item.type === 'polygon' && item.points?.length) return <g className={className}><polygon points={item.points.map(point => `${point.x},${point.y}`).join(' ')} /><title>{title}</title></g>;
  const centerX = item.x + item.width / 2;
  const centerY = item.y + item.height / 2;
  return <g className={className} transform={`rotate(${item.rotation} ${centerX} ${centerY})`}><rect x={item.x} y={item.y} width={item.width} height={item.height} rx="0.003" /><title>{title}</title></g>;
}

export function FloorPlanCanvas(props: FloorPlanCanvasProps) {
  const {plan, spaces, assignments, geometry, visibleSpaceIds, asOfDate, rangeEnd, selectedSpaceId, editMode, tool, newSpaceId, availableOnly, showLabels = true, onOpenPlan, onSelect, onGeometryChange, onCreate} = props;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x: 0, y: 0});
  const [drag, setDrag] = useState<{item: FloorPlanGeometry; start: Point} | null>(null);
  const [panning, setPanning] = useState<{start: Point; origin: Point} | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<Size>({width: 0, height: 0});
  const [loadedImage, setLoadedImage] = useState<(Size & {url: string}) | undefined>();
  const [failedUrl, setFailedUrl] = useState<string>();
  const imagePlan = isFloorPlanImage(plan?.file);
  const imageFailed = !!plan?.file && failedUrl === plan.file.url;
  const imageReady = !!plan?.file && loadedImage?.url === plan.file.url;
  const sourceSize = imageReady ? loadedImage : {
    width: plan?.file?.width || plan?.originalWidth || 0,
    height: plan?.file?.height || plan?.originalHeight || 0,
  };
  const planRect = fitPlanRect(viewportSize, sourceSize);
  const spacesById = useMemo(() => new Map(spaces.map(space => [space.id, space])), [spaces]);
  const assignmentsBySpace = useMemo(() => indexAssignmentsBySpace(assignments), [assignments]);
  const activeWorkstations = useMemo(() => spaces
    .filter(space => space.active && space.assignable && (!visibleSpaceIds || visibleSpaceIds.has(space.id)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true})), [spaces, visibleSpaceIds]);
  const listedWorkstations = useMemo(() => activeWorkstations.map(space => {
    const spaceAssignments = assignmentsBySpace.get(space.id) || [];
    return {
      space,
      status: statusFor(space, spaceAssignments, asOfDate),
      available: getSpaceAvailability(space, spaceAssignments, {start: asOfDate, end: rangeEnd || asOfDate}).available,
    };
  }).filter(item => !availableOnly || item.available), [activeWorkstations, assignmentsBySpace, asOfDate, rangeEnd, availableOnly]);
  const orderedGeometry = useMemo(() => orderMapGeometry(geometry, spacesById), [geometry, spacesById]);
  useEffect(() => { setPolygonPoints([]); }, [tool, newSpaceId, plan?.id]);
  useEffect(() => { setZoom(1); setPan({x: 0, y: 0}); setDrag(null); setPanning(null); }, [plan?.id]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => setViewportSize({width: viewport.clientWidth, height: viewport.clientHeight});
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [plan?.id, plan?.file?.url, imageFailed]);

  function normalized(event: {clientX: number; clientY: number}): Point | undefined {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return rect ? pointOnPlan({x: event.clientX, y: event.clientY}, rect) : undefined;
  }
  function pointerDown(event: React.PointerEvent, item?: FloorPlanGeometry) {
    if (item && editMode && tool === 'select' && !item.locked) {
      event.stopPropagation(); setDrag({item, start: {x: event.clientX, y: event.clientY}}); return;
    }
    if (!editMode || tool === 'select') setPanning({start: {x: event.clientX, y: event.clientY}, origin: pan});
  }
  function pointerMove(event: React.PointerEvent) {
    if (drag && surfaceRef.current && imageReady) {
      const rect = surfaceRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) onGeometryChange(moveGeometry(drag.item, {x: event.clientX - drag.start.x, y: event.clientY - drag.start.y}, rect.width, rect.height));
    } else if (panning) setPan({x: panning.origin.x + event.clientX - panning.start.x, y: panning.origin.y + event.clientY - panning.start.y});
  }
  function clickCanvas(event: React.MouseEvent) {
    if (!editMode || !imageReady || tool === 'select' || !newSpaceId || drag || panning) return;
    const point = normalized(event);
    if (!point) return;
    if (tool === 'polygon') setPolygonPoints(current => [...current, point]);
    else onCreate(tool, point);
  }
  function finishPolygon() {
    if (polygonPoints.length >= 3) onCreate('polygon', polygonPoints[0], polygonPoints);
    setPolygonPoints([]);
  }
  function zoomBy(amount: number) { setZoom(current => Math.max(0.5, Math.min(5, current + amount))); }
  function reset() { setZoom(1); setPan({x: 0, y: 0}); }
  if (!plan?.file || imageFailed) return <section className="workstation-list" aria-label="Workstation list">
    <header className="workstation-list-header">
      <div><p className="eyebrow">Workstation list</p><h2>{availableOnly ? `${listedWorkstations.length} available` : `${activeWorkstations.length} workstation${activeWorkstations.length === 1 ? '' : 's'}`}</h2></div>
      <p>{imageFailed ? 'The plan image could not be loaded. Reopen the extension to refresh the attachment, or check the Plan File in the floor-plan record.' : plan ? 'This plan has no Plan File attachment. Workstations remain usable in this list until one is added.' : 'No floor-plan record is configured for this floor. Workstations remain usable in this list.'}</p>
    </header>
    {plan && <div className="plan-setup-help"><strong>{plan.name}</strong><p>Open this floor-plan record and upload a PNG or JPG into its Plan File attachment field. Then choose Map workstations to draw each area or seat and link it to an existing Space. You can keep the original PDF in the same field.</p>{onOpenPlan && <button className="button primary" onClick={onOpenPlan}>Open floor-plan record</button>}</div>}
    {listedWorkstations.length ? <div className="workstation-rows" role="list">{listedWorkstations.map(({space, status}) => <button type="button" role="listitem" key={space.id} className={space.id === selectedSpaceId ? 'workstation-row selected' : 'workstation-row'} onClick={() => onSelect(space.id)}>
      <span><strong>{space.shortLabel || space.name}</strong><small>{[space.spaceId, space.roomNumber, space.type].filter(Boolean).join(' · ')}</small></span>
      <span className={`workstation-state status-${status}`}>{STATUS_LABELS[status]}</span>
    </button>)}</div> : <div className="workstation-list-empty"><h3>{availableOnly && activeWorkstations.length ? 'No workstations are available for the full date range.' : 'No workstations are recorded for this selection.'}</h3><p>{availableOnly ? 'Change the dates or turn off the availability filter.' : 'Choose another floor or workspace area.'}</p></div>}
  </section>;
  const fileType = (plan.file?.type || plan.file?.filename.split('.').pop() || '').toLowerCase();
  return <div className="map-frame">
    <div className="map-controls" aria-label="Map controls"><button onClick={() => zoomBy(0.25)} aria-label="Zoom in">Zoom in</button><button onClick={() => zoomBy(-0.25)} aria-label="Zoom out">Zoom out</button><button onClick={reset}>Fit plan</button>{onOpenPlan && <button onClick={onOpenPlan}>Open floor-plan record</button>}<a href={plan.file.url} target="_blank" rel="noreferrer">Open plan file</a>{editMode && tool === 'polygon' && polygonPoints.length > 0 && <button disabled={polygonPoints.length < 3} onClick={finishPolygon}>Finish polygon ({polygonPoints.length})</button>}</div>
    {!imagePlan && <div className="plan-preview-note" role="status">PDFs can be previewed here. For a clickable map, add a PNG or JPG export of this page to the same Plan File field; the extension will use that image automatically.</div>}
    <div className={`map-viewport${editMode ? ' editing' : ''}`} ref={viewportRef} tabIndex={0} onPointerDown={event => pointerDown(event)} onPointerMove={pointerMove} onPointerUp={() => {setDrag(null); setPanning(null);}} onPointerLeave={() => {setDrag(null); setPanning(null);}} onClick={clickCanvas}>
      <div className="map-transform" style={{transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`}}>
        <div className="plan-surface" ref={surfaceRef} style={planRect}>
        {String(fileType).includes('pdf') ? <object className="plan-file" data={plan.file.url} type="application/pdf" aria-label={plan.name}><p>PDF preview unavailable. Use Open plan file above.</p></object> : <img className="plan-file" src={plan.file.url} alt={`${plan.name} floor plan`} onLoad={event => setLoadedImage({url: plan.file!.url, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight})} onError={() => setFailedUrl(plan.file!.url)} />}
        {imagePlan && <svg className="geometry-layer" viewBox="0 0 1 1" preserveAspectRatio="none" aria-label={`${plan.name} mapped spaces`}>
          {orderedGeometry.filter(item => item.visible && item.floorPlanId === plan.id).map(item => {
            const space = item.spaceId ? spacesById.get(item.spaceId) : undefined;
            // A linked shape outside the active hierarchy filter is hidden. Shapes whose
            // link is missing or points to a deleted record remain visible as diagnostics.
            if (item.spaceId && space && visibleSpaceIds && !visibleSpaceIds.has(item.spaceId)) return null;
            const status = space ? statusFor(space, assignmentsBySpace.get(space.id) || [], asOfDate) : 'issue';
            const available = space ? getSpaceAvailability(space, assignmentsBySpace.get(space.id) || [], {start: asOfDate, end: rangeEnd || asOfDate}).available : false;
            if (availableOnly && space && (!space.assignable || !available)) return null;
            return <g key={item.id} role="button" tabIndex={0} aria-label={`${space?.name || 'Unlinked geometry'}, ${space && !space.assignable ? 'area' : status}`} onPointerDown={event => pointerDown(event, item)} onClick={event => {event.stopPropagation(); if (editMode && tool !== 'select') clickCanvas(event); else onSelect(item.spaceId);}} onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onSelect(item.spaceId);}}}>
              <GeometryShape item={item} space={space} status={status} selected={item.spaceId === selectedSpaceId} />
              {showLabels && space && item.type !== 'point' && <text x={item.labelX ?? item.x + item.width / 2} y={item.labelY ?? item.y + item.height / 2} textAnchor="middle" dominantBaseline="central">{space.shortLabel || space.roomNumber || space.name}</text>}
            </g>;
          })}
          {polygonPoints.length > 0 && <polyline className="polygon-draft" points={polygonPoints.map(point => `${point.x},${point.y}`).join(' ')} />}
        </svg>}
        </div>
      </div>
    </div>
  </div>;
}
