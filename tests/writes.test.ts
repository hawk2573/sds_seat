import {describe, expect, it, vi} from 'vitest';
import {createAssignment, endAssignment, executeMove, saveGeometry} from '../src/services/airtable/writes';
import {planMove} from '../src/services/assignmentEngine';
import {SchemaConfig} from '../src/config/schema';
import {Assignment, AssignmentDraft, FloorPlanGeometry} from '../src/types/domain';

const config: SchemaConfig = {version: 1, tables: {assignments: {tableId: 'tblAssignments', fields: {
  person: 'fldPerson', space: 'fldSpace', relationshipType: 'fldType', startDate: 'fldStart', expectedEndDate: 'fldExpected',
  actualEndDate: 'fldActual', consumesCapacity: 'fldCapacity', current: 'fldCurrent', status: 'fldStatus', endReason: 'fldEndReason',
  moveFrom: 'fldMoveFrom', moveTo: 'fldMoveTo', moveStatus: 'fldMoveStatus',
}}}};
const draft: AssignmentDraft = {personId: 'recPerson', spaceId: 'recSpace', relationshipType: 'Occupant', startDate: '2026-08-24', expectedEndDate: '2026-12-18', consumesCapacity: true};
const existing: Assignment = {id: 'recAssignment', ...draft};

describe('permission-checked Airtable writes', () => {
  it.each(['', 'tomorrow', '2026-02-30', '2026-10-15T00:00:00Z', '2026-08-23'])('rejects invalid or premature end date %s before writing', async endDate => {
    const table = {updateRecordAsync: vi.fn()};
    await expect(endAssignment(table, existing, endDate, '', config)).rejects.toThrow();
    expect(table.updateRecordAsync).not.toHaveBeenCalled();
  });
  it('requires an authoritative start date before ending an assignment', async () => {
    const table = {updateRecordAsync: vi.fn()};
    await expect(endAssignment(table, {...existing, startDate: undefined}, '2026-10-15', '', config)).rejects.toThrow('Start Date');
    expect(table.updateRecordAsync).not.toHaveBeenCalled();
  });
  it('allows an assignment to end on its inclusive start date', async () => {
    const table = {updateRecordAsync: vi.fn(async () => undefined)};
    await endAssignment(table, existing, existing.startDate!, '', config);
    expect(table.updateRecordAsync).toHaveBeenCalledWith(existing.id, expect.objectContaining({fldActual: existing.startDate}));
  });
  it('creates a linked assignment only after permission succeeds', async () => {
    const table = {checkPermissionsForCreateRecord: vi.fn(() => ({hasPermission: true})), createRecordAsync: vi.fn(async () => 'recNew')};
    await expect(createAssignment(table, draft, config)).resolves.toBe('recNew');
    expect(table.createRecordAsync).toHaveBeenCalledWith(expect.objectContaining({fldPerson: [{id: 'recPerson'}], fldSpace: [{id: 'recSpace'}], fldStart: '2026-08-24'}));
  });
  it('rejects read-only users before a create call', async () => {
    const table = {checkPermissionsForCreateRecord: () => ({hasPermission: false, reasonDisplayString: 'Read only'}), createRecordAsync: vi.fn()};
    await expect(createAssignment(table, draft, config)).rejects.toThrow('Read only');
    expect(table.createRecordAsync).not.toHaveBeenCalled();
  });
  it('ends an assignment without deleting or replacing history', async () => {
    const table = {checkPermissionsForUpdateRecord: () => ({hasPermission: true}), updateRecordAsync: vi.fn(async () => undefined)};
    await endAssignment(table, existing, '2026-10-15', 'Program change', config);
    expect(table.updateRecordAsync).toHaveBeenCalledWith('recAssignment', expect.objectContaining({fldActual: '2026-10-15', fldCurrent: false, fldStatus: {name: 'Ended'}, fldEndReason: 'Program change'}));
  });
  it('creates the destination before closing the source during a move', async () => {
    const order: string[] = [];
    const table = {
      checkPermissionsForCreateRecord: () => ({hasPermission: true}), checkPermissionsForUpdateRecord: () => ({hasPermission: true}),
      createRecordAsync: vi.fn(async () => {order.push('create'); return 'recDestination';}),
      updateRecordAsync: vi.fn(async () => {order.push('close');}),
    };
    const move = planMove(existing, 'recNewSpace', '2026-10-16');
    await expect(executeMove(table, existing, move, config)).resolves.toEqual({newAssignmentId: 'recDestination'});
    expect(order).toEqual(['create', 'close']);
    expect(table.updateRecordAsync).toHaveBeenCalledWith('recAssignment', expect.objectContaining({fldActual: '2026-10-15', fldMoveTo: [{id: 'recNewSpace'}]}));
  });
  it('reports the new record ID when closing the source fails', async () => {
    const table = {
      checkPermissionsForCreateRecord: () => ({hasPermission: true}), checkPermissionsForUpdateRecord: () => ({hasPermission: true}),
      createRecordAsync: async () => 'recDestination', updateRecordAsync: async () => {throw new Error('Update failed');},
    };
    await expect(executeMove(table, existing, planMove(existing, 'recNewSpace', '2026-10-16'), config)).rejects.toThrow('recDestination');
  });
});

describe('map save acknowledgements', () => {
  const shape = (id: string): FloorPlanGeometry => ({id, floorPlanId: 'zone-plan', spaceId: 'desk', type: 'rectangle', x: 0.1, y: 0.2, width: 0.05, height: 0.03, rotation: 0, visible: true, locked: false, zIndex: 1, isNew: true, dirty: true});
  const mapping: SchemaConfig = {version: 1, tables: {geometry: {tableId: 'geometry', fields: {floorPlan: 'plan', space: 'space', x: 'x', y: 'y'}}}};
  it('replaces temporary IDs after save so the next save cannot duplicate shapes', async () => {
    let current = [shape('new')];
    const acknowledge = (saved: Array<{localId: string; saved: FloorPlanGeometry}>) => { current = current.map(item => saved.find(value => value.localId === item.id)?.saved || item); };
    const table = {createRecordsAsync: vi.fn(async () => ['recSaved']), updateRecordsAsync: vi.fn()};
    await saveGeometry(table, current, mapping, acknowledge);
    expect(current[0]).toMatchObject({id: 'recSaved', isNew: false, dirty: false});
    await saveGeometry(table, current, mapping, acknowledge);
    expect(table.createRecordsAsync).toHaveBeenCalledTimes(1);
    expect(table.updateRecordsAsync).not.toHaveBeenCalled();
  });
  it('retains successful batches when a later batch fails, so retry only creates the remainder', async () => {
    let current = Array.from({length: 51}, (_, index) => shape(`new-${index}`));
    const acknowledge = (saved: Array<{localId: string; saved: FloorPlanGeometry}>) => { current = current.map(item => saved.find(value => value.localId === item.id)?.saved || item); };
    const table = {createRecordsAsync: vi.fn().mockResolvedValueOnce(Array.from({length: 50}, (_, i) => `rec${i}`)).mockRejectedValueOnce(new Error('Rate limit')).mockResolvedValueOnce(['rec50']), updateRecordsAsync: vi.fn()};
    await expect(saveGeometry(table, current, mapping, acknowledge)).rejects.toThrow('Rate limit');
    expect(current.filter(item => item.isNew)).toHaveLength(1);
    await saveGeometry(table, current, mapping, acknowledge);
    expect(table.createRecordsAsync.mock.calls.map(call => call[0].length)).toEqual([50, 1, 1]);
    expect(current.every(item => !item.isNew && !item.dirty)).toBe(true);
  });
});
