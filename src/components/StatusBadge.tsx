import React from 'react';

export type SpaceStatus = 'available' | 'occupied' | 'future' | 'ending' | 'issue' | 'inactive' | 'shared';

const labels: Record<SpaceStatus, string> = {
  available: 'Available', occupied: 'Assigned now', future: 'Starts later', ending: 'Ending soon',
  issue: 'Needs review', inactive: 'Inactive', shared: 'Capacity available',
};

export function StatusBadge({status}: {status: SpaceStatus}) {
  return <span className={`status-badge status-${status}`}><span className="status-symbol" aria-hidden="true" />{labels[status]}</span>;
}
