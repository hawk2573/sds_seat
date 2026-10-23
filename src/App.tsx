import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {expandRecord, useBase, useGlobalConfig, useRecords} from '@airtable/blocks/ui';
import {AssignmentDialog} from './components/AssignmentDialog';
import {DetailPanel} from './components/DetailPanel';
import {DiagnosticsPanel} from './components/DiagnosticsPanel';
import {FloorPlanCanvas} from './components/FloorPlanCanvas';
import {MoveDialog} from './components/MoveDialog';
import {PlanSelection} from './components/PlanSelection';
import {PrintPlans} from './components/PrintPlans';
import {SetupWizard} from './components/SetupWizard';
import {CONFIG_KEY, DEFAULT_RULES, discoverSchema, mergeDiscoveredSchema, resolveAssignmentRules, RULES_KEY, SchemaConfig, validateSchema} from './config/schema';
import {assignmentConsumesCapacity, defaultAssignmentDates, getAssignmentsActiveOnDate, getAssignmentsNeedingDateReview, getSpaceAvailability, indexAssignmentsByPerson, indexAssignmentsBySpace, planMove, validateAssignment, validateAssignmentEnd} from './services/assignmentEngine';
import {mapAssignments, mapFloorPlans, mapGeometry, mapPeople, mapPrograms, mapSpaces, mapTerms} from './services/airtable/dataMapper';
import {createAssignment, endAssignment, executeMove, saveGeometry} from './services/airtable/writes';
import {isFloorPlanImage, Size} from './services/floorPlan';
import {planMatchesArea, selectPlans, spacesForPlans} from './services/planSelection';
import {
  createSpaceIndex,
  getActiveWorkstations,
  getEffectiveLevel,
  getEffectiveZone,
  getEffectiveZoneOwnerProgramUnitId,
  getPreferredWorkstationLevel,
  getSpacePath,
  isSpaceInZone,
  getWorkspaceZonesForLevel,
  getWorkstationCountForLevel,
  getWorkstationCountInZone,
  normalizeSpaceKind,
} from './services/spaceHierarchy';
import {AcademicTerm, Assignment, AssignmentDraft, FloorPlan, FloorPlanGeometry, Person, Point, ProgramUnit, Space} from './types/domain';

type View = 'map' | 'unassigned' | 'diagnostics';
const UNZONED = '__unzoned__';

function today(): string { return new Date().toISOString().slice(0, 10); }

function operationalBreadcrumb(space: Space, spacesById: ReadonlyMap<string, Space>): string {
  const labels = getSpacePath(space, spacesById)
    .filter(item => !['building', 'floor'].includes(normalizeSpaceKind(item.type)))
    .map(item => item.shortLabel || item.name);
  return labels.join(' › ') || space.shortLabel || space.name;
}

export function App() {
  const base = useBase() as any;
  const globalConfig = useGlobalConfig() as any;
  const saved = globalConfig.get(CONFIG_KEY) as SchemaConfig | undefined;
  const discovered = useMemo(() => discoverSchema(base), [base]);
  const config = useMemo(() => mergeDiscoveredSchema(saved, discovered), [saved, discovered]);
  const validation = useMemo(() => validateSchema(base, config), [base, config]);
  const [showSetup, setShowSetup] = useState(!saved || !validation.valid);
  const rules = resolveAssignmentRules(globalConfig.get(RULES_KEY) as typeof DEFAULT_RULES | undefined);
  async function saveConfig(next: SchemaConfig, nextRules: typeof DEFAULT_RULES) { await globalConfig.setAsync(CONFIG_KEY, next as any); await globalConfig.setAsync(RULES_KEY, nextRules as any); setShowSetup(false); }
  if (showSetup) return <SetupWizard base={base} initial={config} initialRules={rules} onSave={saveConfig} onCancel={saved && validation.valid ? () => setShowSetup(false) : undefined} />;
  if (!validation.valid) return <SetupWizard base={base} initial={config} initialRules={rules} onSave={saveConfig} />;
  return <CoreData base={base} config={config} rules={rules} openSetup={() => setShowSetup(true)} />;
}

function CoreData({base, config, rules, openSetup}: {base: any; config: SchemaConfig; rules: typeof DEFAULT_RULES; openSetup(): void}) {
  const spacesTable = base.getTableById(config.tables.spaces!.tableId);
  const peopleTable = base.getTableById(config.tables.people!.tableId);
  const assignmentsTable = base.getTableById(config.tables.assignments!.tableId);
  const termsTable = base.getTableById(config.tables.terms!.tableId);
  const programsTable = base.getTableById(config.tables.programs!.tableId);
  const spaceRecords = (useRecords(spacesTable) || []) as unknown as any[];
  const personRecords = (useRecords(peopleTable) || []) as unknown as any[];
  const assignmentRecords = (useRecords(assignmentsTable) || []) as unknown as any[];
  const termRecords = (useRecords(termsTable) || []) as unknown as any[];
  const programRecords = (useRecords(programsTable) || []) as unknown as any[];
  const spaces = useMemo(() => mapSpaces(spaceRecords, config), [spaceRecords, config]);
  const people = useMemo(() => mapPeople(personRecords, config), [personRecords, config]);
  const assignments = useMemo(() => mapAssignments(assignmentRecords, config, rules), [assignmentRecords, config, rules]);
  const terms = useMemo(() => mapTerms(termRecords, config), [termRecords, config]);
  const programs = useMemo(() => mapPrograms(programRecords, config), [programRecords, config]);
  const common = {base, config, rules, openSetup, spacesTable, peopleTable, assignmentsTable, spaces, people, assignments, terms, programs};
  return config.tables.floorPlans ? <OptionalFloorData {...common} /> : <SpaceManager {...common} floorPlans={[]} sourceGeometry={[]} />;
}

function OptionalFloorData(props: any) {
  const {base, config} = props;
  const floorPlansTable = base.getTableById(config.tables.floorPlans!.tableId);
  const floorPlanRecords = (useRecords(floorPlansTable) || []) as unknown as any[];
  const floorPlans = useMemo(() => mapFloorPlans(floorPlanRecords, config), [floorPlanRecords, config]);
  const openFloorPlan = (id: string) => { const record = floorPlanRecords.find(item => item.id === id); if (record) expandRecord(record); };
  const common = {...props, floorPlans, floorPlansTable, openFloorPlan};
  return config.tables.geometry ? <OptionalGeometryData {...common} /> : <SpaceManager {...common} sourceGeometry={[]} />;
}

function OptionalGeometryData(props: any) {
  const {base, config} = props;
  const geometryTable = base.getTableById(config.tables.geometry!.tableId);
  const geometryRecords = (useRecords(geometryTable) || []) as unknown as any[];
  const sourceGeometry = useMemo(() => mapGeometry(geometryRecords, config), [geometryRecords, config]);
  return <SpaceManager {...props} sourceGeometry={sourceGeometry} geometryTable={geometryTable} />;
}

interface ManagerProps {
  config: SchemaConfig; rules: typeof DEFAULT_RULES; openSetup(): void; assignmentsTable: any; geometryTable?: any;
  spaces: Space[]; people: Person[]; assignments: Assignment[]; terms: AcademicTerm[]; programs: ProgramUnit[];
  floorPlans: FloorPlan[]; sourceGeometry: FloorPlanGeometry[];
  openFloorPlan?(id: string): void;
}

function SpaceManager({config, rules, openSetup, assignmentsTable, geometryTable, spaces, people, assignments, terms, programs, floorPlans, sourceGeometry, openFloorPlan}: ManagerProps) {
  const [view, setView] = useState<View>('map');
  const [asOfDate, setAsOfDate] = useState(today());
  const [rangeEnd, setRangeEnd] = useState<string | undefined>();
  const [termId, setTermId] = useState('');
  const [level, setLevel] = useState('');
  const [workspaceAreaId, setWorkspaceAreaId] = useState('');
  const [planId, setPlanId] = useState('');
  const [planSelection, setPlanSelection] = useState<{scope: string; ids: string[]}>();
  const [printMode, setPrintMode] = useState<'plans' | 'roster'>('plans');
  const [preparingPrint, setPreparingPrint] = useState(false);
  const [printImageSizes, setPrintImageSizes] = useState<Record<string, Size>>({});
  const [query, setQuery] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>();
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showMapLabels, setShowMapLabels] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState<'select' | 'point' | 'rectangle' | 'polygon'>('select');
  const [newSpaceId, setNewSpaceId] = useState('');
  const [geometry, setGeometry] = useState(sourceGeometry);
  const [undo, setUndo] = useState<FloorPlanGeometry[][]>([]);
  const [redo, setRedo] = useState<FloorPlanGeometry[][]>([]);
  const [savingGeometry, setSavingGeometry] = useState(false);
  const [message, setMessage] = useState('');
  const [assignmentInitial, setAssignmentInitial] = useState<AssignmentDraft | null>(null);
  const [moveAssignment, setMoveAssignment] = useState<Assignment | null>(null);
  const spacesById = useMemo(() => createSpaceIndex(spaces), [spaces]);
  const peopleById = useMemo(() => new Map(people.map(item => [item.id, item])), [people]);
  const programsById = useMemo(() => new Map(programs.map(item => [item.id, item])), [programs]);
  const bySpace = useMemo(() => indexAssignmentsBySpace(assignments), [assignments]);
  const byPerson = useMemo(() => indexAssignmentsByPerson(assignments), [assignments]);
  const readOnly = useMemo(() => {
    try { return assignmentsTable.checkPermissionsForCreateRecord?.({}).hasPermission === false; } catch { return true; }
  }, [assignmentsTable]);

  useEffect(() => { setGeometry(current => current.some(item => item.dirty || item.isNew) ? current : sourceGeometry); }, [sourceGeometry]);
  const levels = useMemo(() => [...new Set([
    ...floorPlans.map(item => item.level),
    ...spaces.map(item => getEffectiveLevel(item, spacesById)),
  ].filter(Boolean) as string[])].sort(), [floorPlans, spaces, spacesById]);
  const preferredLevel = useMemo(() => getPreferredWorkstationLevel(levels, spaces, spacesById), [levels, spaces, spacesById]);
  const levelWorkstationCounts = useMemo(() => new Map(levels.map(item => [item, getWorkstationCountForLevel(spaces, spacesById, item)])), [levels, spaces, spacesById]);
  useEffect(() => { if ((!level || !levels.includes(level)) && preferredLevel) setLevel(preferredLevel); }, [level, levels, preferredLevel]);
  const floorPlanIds = useMemo(() => new Set(floorPlans.filter(item => item.active && (!level || item.level === level)).map(item => item.id)), [floorPlans, level]);
  const mappedSpaceIds = useMemo(() => new Set([
    ...geometry.filter(item => floorPlanIds.has(item.floorPlanId) && item.visible && item.spaceId).map(item => item.spaceId!),
    ...floorPlans.filter(item => floorPlanIds.has(item.id) && item.zoneId).map(item => item.zoneId!),
  ]), [geometry, floorPlans, floorPlanIds]);
  const workspaceAreas = useMemo(() => getWorkspaceZonesForLevel(spaces, spacesById, level, mappedSpaceIds)
    .sort((a, b) => a.name.localeCompare(b.name)), [spaces, spacesById, level, mappedSpaceIds]);
  const workspaceAreaCounts = useMemo(() => new Map(workspaceAreas.map(item => [item.id, getWorkstationCountInZone(spaces, spacesById, item.id)])), [workspaceAreas, spaces, spacesById]);
  const unzonedWorkstationCount = useMemo(() => getActiveWorkstations(spaces)
    .filter(item => (!level || getEffectiveLevel(item, spacesById) === level) && !getEffectiveZone(item, spacesById)).length, [spaces, spacesById, level]);
  useEffect(() => {
    const invalidArea = workspaceAreaId && workspaceAreaId !== UNZONED && !workspaceAreas.some(item => item.id === workspaceAreaId);
    if (invalidArea || (workspaceAreaId === UNZONED && !unzonedWorkstationCount)) setWorkspaceAreaId('');
  }, [workspaceAreaId, workspaceAreas, unzonedWorkstationCount]);
  const matchingPlans = useMemo(() => floorPlans.filter(item => floorPlanIds.has(item.id) && planMatchesArea(item, workspaceAreaId, spacesById)), [floorPlans, floorPlanIds, workspaceAreaId, spacesById]);
  const selectionScope = `${level}/${workspaceAreaId}`;
  const selectedPlans = useMemo(() => selectPlans(matchingPlans, planSelection?.scope === selectionScope ? planSelection.ids : undefined), [matchingPlans, planSelection, selectionScope]);
  const selectedPlanIds = selectedPlans.map(item => item.id);
  useEffect(() => { if (!matchingPlans.some(item => item.id === planId)) setPlanId(matchingPlans[0]?.id || ''); }, [matchingPlans, planId]);
  const plan = floorPlans.find(item => item.id === planId);
  const floorSpaces = useMemo(() => spaces.filter(item => {
    if (level && getEffectiveLevel(item, spacesById) !== level) return false;
    const effectiveZone = getEffectiveZone(item, spacesById);
    if (workspaceAreaId === UNZONED && effectiveZone) return false;
    if (workspaceAreaId && workspaceAreaId !== UNZONED && !isSpaceInZone(item, workspaceAreaId, spacesById)) return false;
    return true;
  }), [spaces, spacesById, level, workspaceAreaId]);
  const displayedPlans = useMemo(() => editMode && plan ? [plan] : selectedPlans, [editMode, plan, selectedPlans]);
  const displayedSpaces = useMemo(() => matchingPlans.length ? spacesForPlans(floorSpaces, displayedPlans, geometry, spacesById) : floorSpaces, [floorSpaces, matchingPlans.length, displayedPlans, geometry, spacesById]);
  const visibleSpaceIds = useMemo(() => new Set(displayedSpaces.map(item => item.id)), [displayedSpaces]);
  const assignmentSpaces = useMemo(() => spaces.filter(item => item.active && item.assignable), [spaces]);
  const selectedSpace = selectedSpaceId ? spacesById.get(selectedSpaceId) : undefined;
  const filteredAssignments = assignments;
  const metrics = useMemo(() => {
    const assignable = displayedSpaces.filter(item => item.assignable && item.active);
    let occupied = 0, available = 0, conflicts = 0, future = 0, needsReview = 0;
    for (const space of assignable) {
      const availability = getSpaceAvailability(space, bySpace.get(space.id) || [], {start: asOfDate, end: rangeEnd || asOfDate});
      if (availability.needsReview) needsReview++;
      else if (availability.available) available++;
      if (getAssignmentsActiveOnDate(bySpace.get(space.id) || [], asOfDate).some(assignmentConsumesCapacity)) occupied++;
      if (availability.occupied > availability.capacity) conflicts++;
      if ((bySpace.get(space.id) || []).some(item => assignmentConsumesCapacity(item) && item.startDate && item.startDate > asOfDate)) future++;
    }
    const mapped = new Set(geometry.filter(item => displayedPlans.some(plan => plan.id === item.floorPlanId) && item.visible).map(item => item.spaceId));
    return {assignable: assignable.length, occupied, available, conflicts, future, needsReview, unmapped: assignable.filter(item => !mapped.has(item.id)).length};
  }, [displayedSpaces, bySpace, asOfDate, rangeEnd, geometry, displayedPlans]);

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase(); if (needle.length < 2) return {people: [] as Person[], spaces: [] as Space[]};
    return {
      people: people.filter(item => [item.name, item.email, item.personId].some(value => value?.toLowerCase().includes(needle))).slice(0, 8),
      spaces: spaces.filter(item => [item.name, item.shortLabel, item.spaceId, item.roomNumber, operationalBreadcrumb(item, spacesById)]
        .some(value => value?.toLowerCase().includes(needle))).slice(0, 8),
    };
  }, [query, people, spaces, spacesById]);
  function locateSpace(space: Space) {
    const targetLevel = getEffectiveLevel(space, spacesById);
    const targetZone = getEffectiveZone(space, spacesById);
    if (targetLevel) setLevel(targetLevel);
    setWorkspaceAreaId(targetZone?.id || UNZONED);
    setPlanSelection(undefined);
    setEditMode(false);
    setSelectedSpaceId(space.id);
    setView('map');
    setQuery('');
  }
  function locatePerson(person: Person) {
    const personAssignments = byPerson.get(person.id) || [];
    const active = getAssignmentsActiveOnDate(personAssignments, asOfDate).find(item => item.spaceId);
    const future = personAssignments.filter(item => item.spaceId && item.startDate && item.startDate > asOfDate).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))[0];
    const found = active || future;
    if (found?.spaceId) {
      const target = spacesById.get(found.spaceId); if (target) locateSpace(target);
      setMessage(active ? `Located ${person.name} on ${asOfDate}.` : `Showing ${person.name}'s next assignment.`);
    } else { setView('unassigned'); setMessage(`${person.name} has no current or future mapped assignment.`); }
    setQuery('');
  }
  function selectTerm(id: string) { setTermId(id); const term = terms.find(item => item.id === id); if (term) {setAsOfDate(term.startDate); setRangeEnd(term.endDate);} }
  function beginAssign(spaceId?: string, personId?: string) {
    const fieldId = config.tables.assignments?.fields.relationshipType;
    const choices: Array<{name: string}> = fieldId ? assignmentsTable.getFieldByIdIfExists?.(fieldId)?.options?.choices || [] : [];
    const relationshipType = ['Primary Desk Holder', ...rules.capacityRelationships].find(name => choices.some(choice => choice.name === name)) || 'Occupant';
    setAssignmentInitial({personId, spaceId, relationshipType, ...defaultAssignmentDates(terms, asOfDate, termId || undefined), consumesCapacity: true});
  }
  const validateDraft = useCallback((draft: AssignmentDraft) => validateAssignment(draft, assignments, spacesById, peopleById), [assignments, spacesById, peopleById]);
  async function createDraft(draft: AssignmentDraft) { await createAssignment(assignmentsTable, draft, config); setMessage('Assignment created.'); }
  const validateMove = useCallback((spaceId: string, date: string) => {
    if (!moveAssignment) return [];
    try {
      const plan = planMove(moveAssignment, spaceId, date);
      const simulated = assignments.map(item => item.id === moveAssignment.id ? {...item, actualEndDate: plan.closeOldOn} : item);
      return validateAssignment(plan.newAssignment, simulated, spacesById, peopleById);
    } catch (error) { return [{code: 'invalid-move', severity: 'error' as const, message: error instanceof Error ? error.message : String(error)}]; }
  }, [moveAssignment, assignments, spacesById, peopleById]);
  async function performMove(spaceId: string, date: string) { if (!moveAssignment) return; const move = planMove(moveAssignment, spaceId, date); await executeMove(assignmentsTable, moveAssignment, move, config); setMessage('Move completed; assignment history was preserved.'); setSelectedSpaceId(spaceId); }
  async function performEnd(assignment: Assignment) {
    const end = window.prompt('Actual end date (YYYY-MM-DD)', asOfDate); if (!end) return;
    try { validateAssignmentEnd(assignment, end); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); return; }
    if (!window.confirm(`End this assignment on ${end}? History will be preserved.`)) return;
    const reason = window.prompt('End reason (optional)', '') || '';
    try { await endAssignment(assignmentsTable, assignment, end, reason, config); setMessage('Assignment ended.'); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  function changeGeometry(item: FloorPlanGeometry) { if (savingGeometry) return; setGeometry(current => { setUndo(stack => [...stack.slice(-29), current]); setRedo([]); return current.map(value => value.id === item.id ? item : value); }); }
  function createMapItem(type: 'point' | 'rectangle' | 'polygon', point: Point, points?: Point[]) {
    if (savingGeometry || !planId || !newSpaceId) return;
    const item: FloorPlanGeometry = {id: `new-${Date.now()}`, floorPlanId: planId, spaceId: newSpaceId, type, x: point.x, y: point.y, width: type === 'point' ? 0 : 0.07, height: type === 'point' ? 0 : 0.05, rotation: 0, points, zIndex: geometry.length, visible: true, locked: false, dirty: true, isNew: true};
    setUndo(stack => [...stack.slice(-29), geometry]); setRedo([]); setGeometry(current => [...current, item]); setSelectedSpaceId(newSpaceId); setTool('select');
  }
  function undoMap() { if (savingGeometry || !undo.length) return; const prior = undo[undo.length - 1]; setRedo(stack => [...stack, geometry]); setGeometry(prior); setUndo(stack => stack.slice(0, -1)); }
  function redoMap() { if (savingGeometry || !redo.length) return; const next = redo[redo.length - 1]; setUndo(stack => [...stack, geometry]); setGeometry(next); setRedo(stack => stack.slice(0, -1)); }
  async function saveMap() {
    if (!geometryTable || savingGeometry) return;
    setSavingGeometry(true);
    try {
      await saveGeometry(geometryTable, geometry.filter(item => item.floorPlanId === planId), config, saved => {
        const replacements = new Map(saved.map(item => [item.localId, item.saved]));
        setGeometry(current => current.map(item => replacements.get(item.id) || item));
        // Undo snapshots must not restore temporary IDs after a persisted batch.
        setUndo([]); setRedo([]);
      });
      setMessage('Floor-plan geometry saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSavingGeometry(false); }
  }
  const selectedGeometry = geometry.find(item => item.floorPlanId === planId && item.spaceId === selectedSpaceId);
  async function deleteShape() {
    if (savingGeometry || !selectedGeometry || !geometryTable || !window.confirm(`Delete the map geometry for ${selectedSpace?.name || 'this space'}? The Space record and assignment history will not be deleted.`)) return;
    try { if (!selectedGeometry.isNew) await geometryTable.deleteRecordAsync(selectedGeometry.id); setGeometry(current => current.filter(item => item.id !== selectedGeometry.id)); setMessage('Map geometry deleted; the Space record was preserved.'); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  const unassigned = useMemo(() => {
    if (!rules.deskRequiredPersonTypes.length) return [];
    return people.filter(person => rules.deskRequiredPersonTypes.includes(person.personType || '') && !/inactive|former|departed/i.test(person.status || '') && !getAssignmentsNeedingDateReview(byPerson.get(person.id) || []).length && !getAssignmentsActiveOnDate(byPerson.get(person.id) || [], asOfDate).some(assignmentConsumesCapacity));
  }, [people, rules, byPerson, asOfDate]);
  const roster = displayedSpaces.filter(space => space.active && space.assignable).flatMap(space => getAssignmentsActiveOnDate(bySpace.get(space.id) || [], asOfDate).filter(item => item.consumesCapacity).map(assignment => ({space, assignment, person: assignment.personId ? peopleById.get(assignment.personId) : undefined})));
  async function printSelected(mode: 'plans' | 'roster') {
    if (mode === 'plans' && (!selectedPlans.length || selectedPlans.some(item => !isFloorPlanImage(item.file)))) {
      setMessage('Choose at least one plan, and add a PNG or JPG attachment to every selected plan before printing.');
      return;
    }
    setPreparingPrint(true);
    try {
      if (mode === 'plans') setPrintImageSizes(Object.fromEntries(await Promise.all(selectedPlans.map(async item => {
        const img = new Image();
        img.src = item.file!.url;
        await img.decode();
        return [item.file!.url, {width: img.naturalWidth, height: img.naturalHeight}];
      }))));
      setPrintMode(mode);
      // React must commit the selected print output before opening the dialog.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.print();
    } catch {
      setMessage('A selected plan image could not be loaded for printing. Reopen the extension to refresh its attachment, then try again.');
    } finally { setPreparingPrint(false); }
  }

  if (view === 'diagnostics') return <><AppNav view={view} setView={setView} openSetup={openSetup} /><DiagnosticsPanel spaces={spaces} people={people} assignments={assignments} floorPlans={floorPlans} geometry={geometry} /></>;
  if (view === 'unassigned') return <><AppNav view={view} setView={setView} openSetup={openSetup} /><main className="unassigned-view"><div className="page-heading"><div><p className="eyebrow">Workstation assignments</p><h1>People who need a workstation</h1><p>This list uses the Person Types selected in Setup and removes anyone who already has an active workstation assignment. People with incomplete assignment dates are held for review in Diagnostics.</p></div></div>{!rules.deskRequiredPersonTypes.length ? <div className="empty-state"><h2>Choose which people should receive workstations</h2><p>Open Setup and select the Person Types that normally need a workstation, such as MDes or PhD students.</p><button className="button primary" onClick={openSetup}>Choose person types</button></div> : <div className="people-list">{unassigned.map(person => <article key={person.id}><div><strong>{person.name}</strong><span>{person.personType} · {person.programUnitId ? programsById.get(person.programUnitId)?.name : 'No affiliation'}</span></div><button className="button secondary" disabled={readOnly} onClick={() => beginAssign(undefined, person.id)}>Assign workstation</button></article>)}</div>}</main>{assignmentInitial && <AssignmentDialog people={people} spaces={assignmentSpaces} terms={terms} initial={assignmentInitial} validate={validateDraft} onSave={createDraft} onClose={() => setAssignmentInitial(null)} />}</>;

  return <div className="app-shell">
    <AppNav view={view} setView={setView} openSetup={openSetup} />
    <header className="toolbar">
      <div className="brand"><p>School of Design &amp; Society</p><h1>Space Manager</h1></div>
      <label>Floor<select disabled={editMode || preparingPrint} value={level} onChange={event => {setLevel(event.target.value); setWorkspaceAreaId(''); setSelectedSpaceId(undefined);}}>{levels.map(value => <option key={value} value={value}>{value} ({levelWorkstationCounts.get(value) || 0} workstations)</option>)}</select></label>
      <label>Workspace area<select disabled={editMode || preparingPrint} value={workspaceAreaId} onChange={event => {setWorkspaceAreaId(event.target.value); setSelectedSpaceId(undefined);}}><option value="">All workspace areas ({levelWorkstationCounts.get(level) || 0})</option>{workspaceAreas.map(area => {const ownerId = getEffectiveZoneOwnerProgramUnitId(area, spacesById); const owner = ownerId ? programsById.get(ownerId)?.name : undefined; return <option key={area.id} value={area.id}>{area.name} ({workspaceAreaCounts.get(area.id) || 0}){owner ? ` — ${owner}` : ''}</option>;})}{unzonedWorkstationCount > 0 && <option value={UNZONED}>Other / not assigned to an area ({unzonedWorkstationCount})</option>}</select></label>
      <label>View date<input type="date" disabled={preparingPrint} value={asOfDate} onChange={event => {setAsOfDate(event.target.value); setTermId('');}} /></label>
      <label>Academic term<select disabled={preparingPrint} value={termId} onChange={event => selectTerm(event.target.value)}><option value="">Arbitrary date</option>{terms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
      <div className="search-box"><label htmlFor="global-search">Search people or spaces</label><input id="global-search" disabled={editMode || preparingPrint} value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, email, ID, room…" />{query.trim().length >= 2 && <div className="search-results">{searchResults.people.map(person => <button key={person.id} onClick={() => locatePerson(person)}><strong>{person.name}</strong><span>{person.email || person.personType || 'Person'}</span></button>)}{searchResults.spaces.map(space => <button key={space.id} onClick={() => locateSpace(space)}><strong>{space.name}</strong><span>{operationalBreadcrumb(space, spacesById)}</span></button>)}{!searchResults.people.length && !searchResults.spaces.length && <p>No matches.</p>}</div>}</div>
      <button className="button secondary toolbar-button" disabled={preparingPrint} onClick={() => {setAsOfDate(today()); setRangeEnd(undefined); setTermId('');}}>Today</button>
      {editMode && <button className="button secondary toolbar-button" disabled={savingGeometry} onClick={() => setEditMode(false)}>Exit mapping</button>}
    </header>
    <section className="filters-bar">
      <label className="check-label"><input type="checkbox" disabled={preparingPrint} checked={showMapLabels} onChange={event => setShowMapLabels(event.target.checked)} />Show record labels</label>
      <label className="check-label"><input type="checkbox" disabled={preparingPrint} checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)} />Highlight available workstations</label>
      {availableOnly && <><label>Available through<input type="date" disabled={preparingPrint} min={asOfDate} value={rangeEnd || asOfDate} onChange={event => setRangeEnd(event.target.value)} /></label><span className="filter-summary">Results must remain available for the full date range.</span></>}
      <button className="text-button" disabled={preparingPrint || editMode || !selectedPlans.length} onClick={() => printSelected('plans')}>{preparingPrint ? 'Preparing print…' : `Print selected plans (${selectedPlans.length})`}</button>
      <button className="text-button" disabled={preparingPrint || editMode} onClick={() => printSelected('roster')}>Print workspace roster</button>
    </section>
    <PlanSelection plans={matchingPlans} selectedIds={selectedPlanIds} disabled={editMode || preparingPrint} onChange={ids => {setPlanSelection({scope: selectionScope, ids}); setSelectedSpaceId(undefined);}} />
    {editMode && <section className="editor-bar" aria-label="Floor plan editor">
      <strong>{plan?.name}</strong>
      <label>Tool<select value={tool} onChange={event => setTool(event.target.value as typeof tool)}><option value="select">Select / move</option><option value="point">Draw point</option><option value="rectangle">Draw rectangle</option><option value="polygon">Draw polygon</option></select></label>
      {tool !== 'select' && <label>Link new geometry to Space<select value={newSpaceId} onChange={event => setNewSpaceId(event.target.value)}><option value="">Choose a Space…</option>{displayedSpaces.map(item => <option key={item.id} value={item.id}>{operationalBreadcrumb(item, spacesById)}</option>)}</select></label>}
      <button onClick={undoMap} disabled={!undo.length}>Undo</button><button onClick={redoMap} disabled={!redo.length}>Redo</button>
      {selectedGeometry && <><label>Width<input type="number" min="0.005" max="1" step="0.005" value={selectedGeometry.width} onChange={event => changeGeometry({...selectedGeometry, width: Number(event.target.value), dirty: true})} /></label><label>Height<input type="number" min="0.005" max="1" step="0.005" value={selectedGeometry.height} onChange={event => changeGeometry({...selectedGeometry, height: Number(event.target.value), dirty: true})} /></label><label>Rotation<input type="number" min="-180" max="180" value={selectedGeometry.rotation} onChange={event => changeGeometry({...selectedGeometry, rotation: Number(event.target.value), dirty: true})} /></label><label className="check-label"><input type="checkbox" checked={selectedGeometry.locked} onChange={event => changeGeometry({...selectedGeometry, locked: event.target.checked, dirty: true})} />Locked</label><button className="danger-control" onClick={deleteShape}>Delete map shape</button></>}
      <button className="button primary" disabled={savingGeometry || !geometry.some(item => item.floorPlanId === planId && (item.dirty || item.isNew))} onClick={saveMap}>{savingGeometry ? 'Saving…' : 'Save map edits'}</button>
    </section>}
    <section className="metrics" aria-label="Workspace summary"><Metric label="Workstations" value={metrics.assignable} /><Metric label="Assigned now" value={metrics.occupied} /><Metric label="Available" value={metrics.available} /><Metric label="Starting later" value={metrics.future} /><Metric label="Needs review" value={metrics.needsReview} issue={metrics.needsReview > 0} /><Metric label="Over capacity" value={metrics.conflicts} issue={metrics.conflicts > 0} /><Metric label="Not on plan" value={metrics.unmapped} /></section>
    {message && <div className="toast" role="status"><span>{message}</span><button aria-label="Dismiss" onClick={() => setMessage('')}>×</button></div>}
    <main className="workspace"><div className="map-column">
      <div className="plan-gallery">
        {displayedPlans.map(displayPlan => {
          const planSpaceIds = new Set(spacesForPlans(floorSpaces, [displayPlan], geometry, spacesById).map(item => item.id));
          return <section className="plan-card" key={displayPlan.id} aria-label={displayPlan.name}>
            <header className="plan-card-header"><h2>{displayPlan.name}</h2>{!editMode && <button className="button secondary" disabled={preparingPrint || readOnly || !geometryTable || !isFloorPlanImage(displayPlan.file)} title={!isFloorPlanImage(displayPlan.file) ? 'Add a PNG or JPG attachment to enable mapping.' : undefined} onClick={() => {setPlanId(displayPlan.id); setUndo([]); setRedo([]); setNewSpaceId(''); setTool('select'); setSelectedSpaceId(undefined); setEditMode(true);}}>Map workstations</button>}</header>
            <div className="plan-card-map"><FloorPlanCanvas showLabels={showMapLabels} plan={displayPlan} spaces={spaces} visibleSpaceIds={planSpaceIds} assignments={filteredAssignments} geometry={geometry} asOfDate={asOfDate} rangeEnd={rangeEnd} selectedSpaceId={selectedSpaceId} editMode={editMode} tool={tool} newSpaceId={newSpaceId} availableOnly={availableOnly} onOpenPlan={openFloorPlan ? () => openFloorPlan(displayPlan.id) : undefined} onSelect={setSelectedSpaceId} onGeometryChange={changeGeometry} onCreate={createMapItem} /></div>
          </section>;
        })}
        {!matchingPlans.length && <FloorPlanCanvas spaces={spaces} visibleSpaceIds={visibleSpaceIds} assignments={filteredAssignments} geometry={geometry} asOfDate={asOfDate} rangeEnd={rangeEnd} selectedSpaceId={selectedSpaceId} editMode={false} tool="select" availableOnly={availableOnly} onSelect={setSelectedSpaceId} onGeometryChange={changeGeometry} onCreate={createMapItem} />}
        {!!matchingPlans.length && !displayedPlans.length && <div className="empty-state"><h2>Choose plans to view</h2><p>Select one or more plans above. Each selected plan can be printed on a separate page.</p></div>}
      </div>
      {displayedPlans.some(item => isFloorPlanImage(item.file)) && <div className="legend" aria-label="Map legend"><span className="status-area">Area / room</span><span className="status-available">Available</span><span className="status-occupied">Assigned now</span><span className="status-future">Starts later</span><span className="status-shared">Capacity available</span><span className="status-issue">Needs review</span></div>}
    </div><DetailPanel space={selectedSpace} spacesById={spacesById} assignments={assignments} peopleById={peopleById} programsById={programsById} asOfDate={asOfDate} readOnly={readOnly} onClose={() => setSelectedSpaceId(undefined)} onAssign={() => beginAssign(selectedSpaceId)} onMove={setMoveAssignment} onEnd={performEnd} onSelectSpace={setSelectedSpaceId} /></main>
    <section className="print-output">{printMode === 'plans' ? <PrintPlans showLabels={showMapLabels} imageSizes={printImageSizes} plans={selectedPlans} spaces={floorSpaces} spacesById={spacesById} geometry={geometry} assignments={assignments} asOfDate={asOfDate} rangeEnd={rangeEnd} availableOnly={availableOnly} /> : <div className="print-roster"><h1>{level}</h1><p>Space roster as of {asOfDate} · {selectedPlans.map(item => item.name).join(', ') || 'Workspace list'}</p><table><thead><tr><th>Space</th><th>Person</th><th>Person affiliation</th><th>End date</th></tr></thead><tbody>{roster.map(({space, assignment, person}) => <tr key={assignment.id}><td>{operationalBreadcrumb(space, spacesById)}</td><td>{person?.name || 'Missing person'}</td><td>{person?.programUnitId ? programsById.get(person.programUnitId)?.name : ''}</td><td>{assignment.actualEndDate || assignment.expectedEndDate || 'Open-ended'}</td></tr>)}</tbody></table></div>}</section>
    {assignmentInitial && <AssignmentDialog people={people} spaces={assignmentSpaces} terms={terms} initial={assignmentInitial} validate={validateDraft} onSave={createDraft} onClose={() => setAssignmentInitial(null)} />}
    {moveAssignment && <MoveDialog assignment={moveAssignment} spaces={assignmentSpaces} initialDate={rangeEnd || asOfDate} validate={validateMove} onSave={performMove} onClose={() => setMoveAssignment(null)} />}
  </div>;
}

function Metric({label, value, issue}: {label: string; value: number; issue?: boolean}) { return <div className={issue ? 'metric issue' : 'metric'}><strong>{value}</strong><span>{label}</span></div>; }

function AppNav({view, setView, openSetup}: {view: View; setView(view: View): void; openSetup(): void}) {
  return <nav className="app-nav" aria-label="Primary"><button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Workspaces</button><button className={view === 'unassigned' ? 'active' : ''} onClick={() => setView('unassigned')}>Needs workspace</button><button className={view === 'diagnostics' ? 'active' : ''} onClick={() => setView('diagnostics')}>Diagnostics</button><button onClick={openSetup}>Setup</button></nav>;
}
