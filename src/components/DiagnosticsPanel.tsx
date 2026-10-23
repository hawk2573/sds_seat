import React, {useMemo, useState} from 'react';
import {Assignment, FloorPlan, FloorPlanGeometry, Person, Space} from '../types/domain';
import {runDiagnostics} from '../services/diagnostics';

export function DiagnosticsPanel({spaces, people, assignments, floorPlans, geometry}: {spaces: Space[]; people: Person[]; assignments: Assignment[]; floorPlans: FloorPlan[]; geometry: FloorPlanGeometry[]}) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const issues = useMemo(() => runDiagnostics(spaces, people, assignments, floorPlans, geometry), [spaces, people, assignments, floorPlans, geometry]);
  const shown = filter === 'all' ? issues : issues.filter(item => item.severity === filter);
  return <main className="diagnostics-view">
    <div className="page-heading"><div><p className="eyebrow">Administration</p><h1>Data diagnostics</h1><p>Ambiguous conditions are reported for intentional review. No records are changed here.</p></div><div className="diagnostic-counts"><span><strong>{issues.filter(item => item.severity === 'error').length}</strong> errors</span><span><strong>{issues.filter(item => item.severity === 'warning').length}</strong> warnings</span><span><strong>{issues.filter(item => item.severity === 'info').length}</strong> notices</span></div></div>
    <div className="filter-row" role="group" aria-label="Diagnostic severity">{(['all', 'error', 'warning', 'info'] as const).map(value => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div>
    <div className="diagnostic-list">{shown.length ? shown.map((issue, index) => <article className={`diagnostic-item ${issue.severity}`} key={`${issue.code}-${index}`}><span className="diagnostic-severity">{issue.severity}</span><div><strong>{issue.message}</strong><p>{issue.code}{issue.relatedRecordIds?.length ? ` · ${issue.relatedRecordIds.length} related record(s)` : ''}</p></div></article>) : <div className="empty-state"><h2>No issues in this view</h2><p>The configured data passed the currently available checks.</p></div>}</div>
  </main>;
}
