"use client";

import type { Goal } from "@/lib/goals-api";

interface GoalItemProps {
  goal: Goal;
  busy: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function GoalItem({ goal, busy, onToggle, onDelete }: GoalItemProps) {
  const checkboxId = `goal-${goal.id}`;

  return (
    <li className={goal.done ? "goal goal-done" : "goal"}>
      <input
        id={checkboxId}
        type="checkbox"
        checked={goal.done}
        disabled={busy}
        onChange={() => onToggle(goal.id)}
      />
      <label htmlFor={checkboxId} className="goal-text">
        <span className="goal-title">{goal.title}</span>
        <span className="goal-skill">{goal.targetSkill}</span>
      </label>
      <button
        type="button"
        className="button-delete"
        disabled={busy}
        aria-label={`Delete goal: ${goal.title}`}
        onClick={() => onDelete(goal.id)}
      >
        Delete
      </button>
    </li>
  );
}
