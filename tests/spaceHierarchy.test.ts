import {describe, expect, it} from 'vitest';
import {
  createSpaceIndex,
  getEffectiveBuilding,
  getEffectiveFloor,
  getEffectiveLevel,
  getEffectiveRoom,
  getEffectiveZone,
  getEffectiveZoneOwnerProgramUnitId,
  getHierarchyBreadcrumb,
  getPreferredWorkstationLevel,
  getSpaceAncestors,
  getSpaceDescendants,
  getSpacePath,
  getWorkspaceZonesForLevel,
  getWorkstationCountForLevel,
  getWorkstationCountInZone,
  isDescendantOf,
  isSpaceInRoom,
  isSpaceInZone,
  normalizeSpaceKind,
} from '../src/services/spaceHierarchy';
import {Space} from '../src/types/domain';

function space(id: string, name: string, type: string, overrides: Partial<Space> = {}): Space {
  return {
    id,
    name,
    type,
    active: true,
    assignable: type === 'Workstation',
    assignmentMode: type === 'Workstation' ? 'exclusive' : 'non-occupancy',
    assignmentCapacity: type === 'Workstation' ? 1 : 0,
    ...overrides,
  };
}

const building = space('building', 'Kaplan Institute', 'Building', {shortLabel: 'KI'});
const floor = space('floor', 'First Floor', 'Level', {parentSpaceId: building.id, level: 'Level 1'});
const zone = space('zone', 'MDes Zone', 'Zone', {parentSpaceId: floor.id, programUnitId: 'mdes'});
const room = space('room', 'Open Studio 101', 'Room', {parentSpaceId: zone.id, roomNumber: '101'});
const workstation = space('desk', 'Workstation 12', 'Workstation', {parentSpaceId: room.id});
const directWorkstation = space('direct-desk', 'Workstation 13', 'Desk', {parentSpaceId: zone.id});
const spaces = [building, floor, zone, room, workstation, directWorkstation];
const index = createSpaceIndex(spaces);

describe('space type normalization', () => {
  it('normalizes hierarchy types and legacy workstation/area labels', () => {
    expect(normalizeSpaceKind(' BUILDING ')).toBe('building');
    expect(normalizeSpaceKind('Level')).toBe('floor');
    expect(normalizeSpaceKind('Floor / Level')).toBe('floor');
    expect(normalizeSpaceKind('Area')).toBe('zone');
    expect(normalizeSpaceKind('Zone / Area')).toBe('zone');
    expect(normalizeSpaceKind('Student Desk')).toBe('workstation');
    expect(normalizeSpaceKind('Faculty Office')).toBe('room');
    expect(normalizeSpaceKind('Storage')).toBe('other');
  });
});

describe('hierarchy traversal', () => {
  it('returns nearest-first ancestors and a root-to-leaf path', () => {
    expect(getSpaceAncestors(workstation, index).map(item => item.id)).toEqual(['room', 'zone', 'floor', 'building']);
    expect(getSpacePath(workstation, index).map(item => item.id)).toEqual(['building', 'floor', 'zone', 'room', 'desk']);
    expect(getHierarchyBreadcrumb(workstation, index)).toBe('KI › First Floor › MDes Zone › Open Studio 101 › Workstation 12');
  });

  it('resolves zone and room for nested and direct-under-zone workstations', () => {
    expect(getEffectiveZone(workstation, index)?.id).toBe('zone');
    expect(getEffectiveRoom(workstation, index)?.id).toBe('room');
    expect(getEffectiveZone(directWorkstation, index)?.id).toBe('zone');
    expect(getEffectiveRoom(directWorkstation, index)).toBeUndefined();
  });

  it('resolves effective floor, level, and building metadata', () => {
    expect(getEffectiveFloor(workstation, index)?.id).toBe('floor');
    expect(getEffectiveLevel(workstation, index)).toBe('Level 1');
    expect(getEffectiveBuilding(workstation, index)).toBe('KI');
    const noLegacyMetadata = [
      space('b2', 'Second Building', 'Building'),
      space('f2', 'Second Floor', 'Floor', {parentSpaceId: 'b2'}),
      space('d2', 'Desk 2', 'Desk', {parentSpaceId: 'f2'}),
    ];
    const secondIndex = createSpaceIndex(noLegacyMetadata);
    expect(getEffectiveLevel(noLegacyMetadata[2], secondIndex)).toBe('Second Floor');
    expect(getEffectiveBuilding(noLegacyMetadata[2], secondIndex)).toBe('Second Building');
  });

  it('stops safely at missing parents and cycles', () => {
    const orphan = space('orphan', 'Orphan Desk', 'Desk', {parentSpaceId: 'missing'});
    expect(getSpacePath(orphan, createSpaceIndex([orphan]))).toEqual([orphan]);
    const a = space('a', 'A', 'Zone', {parentSpaceId: 'b'});
    const b = space('b', 'B', 'Room', {parentSpaceId: 'a'});
    const cyclicIndex = createSpaceIndex([a, b]);
    expect(getSpaceAncestors(a, cyclicIndex).map(item => item.id)).toEqual(['b']);
    expect(getSpacePath(a, cyclicIndex).map(item => item.id)).toEqual(['b', 'a']);
  });
});

describe('zone ownership and descendant filtering', () => {
  it('includes mapped administrative areas without desks while keeping unmapped areas out of navigation', () => {
    const shared = space('shared', 'Shared & Administrative', 'Zone', {parentSpaceId: floor.id});
    const office = space('office', 'Faculty Office', 'Room', {parentSpaceId: shared.id});
    const other = space('other', 'Unmapped lounge', 'Zone', {parentSpaceId: floor.id});
    const set = [...spaces, shared, office, other];
    const setIndex = createSpaceIndex(set);
    expect(getWorkspaceZonesForLevel(set, setIndex, 'Level 1', new Set(['office'])).map(item => item.id))
      .toEqual(['zone', 'shared']);
    expect(getWorkspaceZonesForLevel(set, setIndex, 'Level 1', new Set(['shared'])).map(item => item.id))
      .toEqual(['zone', 'shared']);
    expect(getWorkspaceZonesForLevel(set, setIndex, 'Level 2', new Set(['shared']))).toEqual([]);
    expect(getWorkstationCountInZone(set, setIndex, shared.id)).toBe(0);
  });
  it('inherits ownership from the zone and lets the zone win a legacy conflict', () => {
    expect(getEffectiveZoneOwnerProgramUnitId(workstation, index)).toBe('mdes');
    const conflictingDesk = {...workstation, id: 'conflict', programUnitId: 'legacy-phd'};
    expect(getEffectiveZoneOwnerProgramUnitId(conflictingDesk, createSpaceIndex([...spaces, conflictingDesk]))).toBe('mdes');
  });

  it('falls back to the direct legacy owner when no owned zone exists', () => {
    const unownedZone = space('unowned-zone', 'Unowned Zone', 'Zone');
    const legacyDesk = space('legacy', 'Legacy Desk', 'Desk', {parentSpaceId: unownedZone.id, programUnitId: 'legacy-owner'});
    expect(getEffectiveZoneOwnerProgramUnitId(legacyDesk, createSpaceIndex([unownedZone, legacyDesk]))).toBe('legacy-owner');
  });

  it('finds descendants and applies zone/room predicates without including siblings', () => {
    expect(getSpaceDescendants(zone.id, spaces, index).map(item => item.id)).toEqual(['room', 'desk', 'direct-desk']);
    expect(isDescendantOf(workstation, zone.id, index)).toBe(true);
    expect(isDescendantOf(zone, zone.id, index)).toBe(false);
    expect(isDescendantOf(zone, zone.id, index, true)).toBe(true);
    expect(isSpaceInZone(workstation, zone.id, index)).toBe(true);
    expect(isSpaceInZone(floor, zone.id, index)).toBe(false);
    expect(isSpaceInRoom(workstation, room.id, index)).toBe(true);
    expect(isSpaceInRoom(directWorkstation, room.id, index)).toBe(false);
  });

  it('surfaces only Zones that contain active workstations and prefers a floor with workstations', () => {
    const floorOne = space('floor-one', 'Level 1', 'Floor', {level: 'Level 1'});
    const emptyZone = space('empty-zone', 'Empty Zone', 'Zone', {parentSpaceId: floorOne.id});
    const floorTwo = space('floor-two', 'Level 2', 'Floor', {level: 'Level 2'});
    const workingZone = space('working-zone', 'Working Zone', 'Zone', {parentSpaceId: floorTwo.id, programUnitId: 'mdes'});
    const activeDesk = space('active-desk', 'Desk 1', 'Desk / Workstation', {parentSpaceId: workingZone.id, assignable: true});
    const inactiveDesk = space('inactive-desk', 'Desk 2', 'Desk / Workstation', {parentSpaceId: workingZone.id, assignable: true, active: false});
    const set = [floorOne, emptyZone, floorTwo, workingZone, activeDesk, inactiveDesk];
    const setIndex = createSpaceIndex(set);

    expect(getWorkspaceZonesForLevel(set, setIndex, 'Level 1')).toEqual([]);
    expect(getWorkspaceZonesForLevel(set, setIndex, 'Level 2').map(item => item.id)).toEqual(['working-zone']);
    expect(getWorkstationCountForLevel(set, setIndex, 'Level 2')).toBe(1);
    expect(getWorkstationCountInZone(set, setIndex, 'working-zone')).toBe(1);
    expect(getPreferredWorkstationLevel(['Level 1', 'Level 2'], set, setIndex)).toBe('Level 2');
  });
});
