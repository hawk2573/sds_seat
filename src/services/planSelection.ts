import {FloorPlan, FloorPlanGeometry, Space} from '../types/domain';
import {isSpaceInZone} from './spaceHierarchy';

/** An unscoped plan is a full-floor view; a scoped plan may cover a nested area. */
export function planMatchesArea(plan: FloorPlan, areaId: string, spacesById: ReadonlyMap<string, Space>): boolean {
  if (!areaId || !plan.zoneId) return true;
  if (plan.zoneId === areaId) return true;
  const zone = spacesById.get(plan.zoneId);
  const area = spacesById.get(areaId);
  return !!((zone && isSpaceInZone(zone, areaId, spacesById)) || (area && isSpaceInZone(area, plan.zoneId, spacesById)));
}

/** Keep an explicit empty selection empty. Default to zone sheets when available. */
export function selectPlans(plans: FloorPlan[], selectedIds?: readonly string[]): FloorPlan[] {
  if (selectedIds) return plans.filter(plan => selectedIds.includes(plan.id));
  const zones = plans.filter(plan => plan.zoneId);
  return zones.length ? zones : plans.slice(0, 1);
}

/** A shared workstation may be mapped on two sheets, but still counts only once. */
export function spacesForPlans(spaces: Space[], plans: FloorPlan[], geometry: FloorPlanGeometry[], spacesById: ReadonlyMap<string, Space>): Space[] {
  if (plans.some(plan => !plan.zoneId)) return spaces;
  const ids = new Set(plans.map(plan => plan.id));
  const mapped = new Set(geometry.filter(item => ids.has(item.floorPlanId) && item.visible).map(item => item.spaceId));
  return spaces.filter(space => mapped.has(space.id) || plans.some(plan => isSpaceInZone(space, plan.zoneId!, spacesById)));
}
