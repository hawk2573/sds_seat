import {Space} from '../types/domain';

export type SpaceKind = 'building' | 'floor' | 'zone' | 'room' | 'workstation' | 'other';
export type SpaceIndex = ReadonlyMap<string, Space>;

const KIND_PATTERNS: ReadonlyArray<readonly [SpaceKind, RegExp]> = [
  ['building', /\b(building|campus)\b/],
  ['floor', /\b(floor|level|storey|story)\b/],
  ['zone', /\b(zone|area|neighbou?rhood)\b/],
  ['workstation', /\b(work\s*station|desk|seat|cubicle)\b/],
  ['room', /\b(room|office|studio|lab(?:oratory)?|classroom|conference|shop)\b/],
];

export function normalizeSpaceKind(type?: string): SpaceKind {
  const normalized = (type || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return 'other';
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(normalized))?.[0] || 'other';
}

export function isSpaceKind(space: Pick<Space, 'type'>, kind: SpaceKind): boolean {
  return normalizeSpaceKind(space.type) === kind;
}

export function createSpaceIndex(spaces: readonly Space[]): Map<string, Space> {
  return new Map(spaces.map(space => [space.id, space]));
}

export function getSpaceAncestors(space: Space, spacesById: SpaceIndex): Space[] {
  const ancestors: Space[] = [];
  const visited = new Set<string>([space.id]);
  let parentId = space.parentSpaceId;
  while (parentId && !visited.has(parentId)) {
    const parent = spacesById.get(parentId);
    if (!parent) break;
    ancestors.push(parent);
    visited.add(parent.id);
    parentId = parent.parentSpaceId;
  }
  return ancestors;
}

export function getSpacePath(space: Space, spacesById: SpaceIndex): Space[] {
  return [...getSpaceAncestors(space, spacesById)].reverse().concat(space);
}

function nearestKind(space: Space, spacesById: SpaceIndex, kind: SpaceKind): Space | undefined {
  return [space, ...getSpaceAncestors(space, spacesById)].find(candidate => isSpaceKind(candidate, kind));
}

export function getEffectiveZone(space: Space, spacesById: SpaceIndex): Space | undefined {
  return nearestKind(space, spacesById, 'zone');
}

export function getEffectiveRoom(space: Space, spacesById: SpaceIndex): Space | undefined {
  return nearestKind(space, spacesById, 'room');
}

export function getEffectiveFloor(space: Space, spacesById: SpaceIndex): Space | undefined {
  return nearestKind(space, spacesById, 'floor');
}

export function getEffectiveBuildingSpace(space: Space, spacesById: SpaceIndex): Space | undefined {
  return nearestKind(space, spacesById, 'building');
}

export function getEffectiveLevel(space: Space, spacesById: SpaceIndex): string | undefined {
  const lineage = [space, ...getSpaceAncestors(space, spacesById)];
  const explicit = lineage.find(candidate => candidate.level?.trim())?.level?.trim();
  if (explicit) return explicit;
  const floor = lineage.find(candidate => isSpaceKind(candidate, 'floor'));
  return floor ? (floor.shortLabel || floor.name).trim() || undefined : undefined;
}

export function getEffectiveBuilding(space: Space, spacesById: SpaceIndex): string | undefined {
  const lineage = [space, ...getSpaceAncestors(space, spacesById)];
  const explicit = lineage.find(candidate => candidate.building?.trim())?.building?.trim();
  if (explicit) return explicit;
  const building = lineage.find(candidate => isSpaceKind(candidate, 'building'));
  return building ? (building.shortLabel || building.name).trim() || undefined : undefined;
}

export function getEffectiveZoneOwnerProgramUnitId(space: Space, spacesById: SpaceIndex): string | undefined {
  return getEffectiveZone(space, spacesById)?.programUnitId || space.programUnitId;
}

export function isDescendantOf(space: Space, ancestorId: string, spacesById: SpaceIndex, includeSelf = false): boolean {
  if (includeSelf && space.id === ancestorId) return true;
  return getSpaceAncestors(space, spacesById).some(ancestor => ancestor.id === ancestorId);
}

export function getSpaceDescendants(
  ancestorId: string,
  spaces: readonly Space[],
  spacesById: SpaceIndex = createSpaceIndex(spaces),
): Space[] {
  return spaces.filter(space => space.id !== ancestorId && isDescendantOf(space, ancestorId, spacesById));
}

export function getActiveWorkstations(spaces: readonly Space[]): Space[] {
  return spaces.filter(space => space.active && space.assignable);
}

export function getWorkstationCountForLevel(spaces: readonly Space[], spacesById: SpaceIndex, level: string): number {
  return getActiveWorkstations(spaces).filter(space => getEffectiveLevel(space, spacesById) === level).length;
}

export function getWorkstationCountInZone(spaces: readonly Space[], spacesById: SpaceIndex, zoneId: string): number {
  return getActiveWorkstations(spaces).filter(space => isSpaceInZone(space, zoneId, spacesById)).length;
}

export function getWorkspaceZonesForLevel(spaces: readonly Space[], spacesById: SpaceIndex, level?: string, mappedSpaceIds: ReadonlySet<string> = new Set()): Space[] {
  return spaces.filter(space => space.active
    && isSpaceKind(space, 'zone')
    && (!level || getEffectiveLevel(space, spacesById) === level)
    && (getWorkstationCountInZone(spaces, spacesById, space.id) > 0
      || mappedSpaceIds.has(space.id)
      || spaces.some(child => child.active && mappedSpaceIds.has(child.id) && isDescendantOf(child, space.id, spacesById))));
}

export function getPreferredWorkstationLevel(levels: readonly string[], spaces: readonly Space[], spacesById: SpaceIndex): string | undefined {
  return levels.find(level => getWorkstationCountForLevel(spaces, spacesById, level) > 0) || levels[0];
}

export function isSpaceInZone(space: Space, zoneId: string, spacesById: SpaceIndex): boolean {
  return isSpaceKind(spacesById.get(zoneId) || space, 'zone')
    && (space.id === zoneId || isDescendantOf(space, zoneId, spacesById));
}

export function isSpaceInRoom(space: Space, roomId: string, spacesById: SpaceIndex): boolean {
  return isSpaceKind(spacesById.get(roomId) || space, 'room')
    && (space.id === roomId || isDescendantOf(space, roomId, spacesById));
}

export function getHierarchyBreadcrumb(space: Space, spacesById: SpaceIndex, separator = ' › '): string {
  return getSpacePath(space, spacesById).map(item => item.shortLabel || item.name).join(separator);
}
