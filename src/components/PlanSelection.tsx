import React from 'react';
import {FloorPlan} from '../types/domain';

export function PlanSelection({plans, selectedIds, disabled, onChange}: {
  plans: FloorPlan[]; selectedIds: readonly string[]; disabled?: boolean; onChange(ids: string[]): void;
}) {
  if (!plans.length) return null;
  return <fieldset className="plan-selection" disabled={disabled}>
    <legend>Plans to view / print</legend>
    <div className="plan-choices">{plans.map(plan => <label className="check-label" key={plan.id}>
      <input type="checkbox" checked={selectedIds.includes(plan.id)} onChange={event => onChange(event.target.checked ? [...selectedIds, plan.id] : selectedIds.filter(id => id !== plan.id))} />
      {plan.name}
    </label>)}</div>
    <div className="plan-selection-actions"><button className="text-button" onClick={() => onChange(plans.map(plan => plan.id))}>Select all</button><button className="text-button" onClick={() => onChange([])}>Clear</button><span>{selectedIds.length} selected{disabled ? ' · Exit mapping to change plans' : ''}</span></div>
  </fieldset>;
}
