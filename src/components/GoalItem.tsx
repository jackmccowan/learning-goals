"use client";

import type { Goal } from "@/lib/goals-api";

// Dates are stored as midnight UTC, so format in UTC too. Formatting in the
// viewer's own time zone would show the previous day west of Greenwich.
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

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
        <span className="goal-skill">
          {goal.targetSkill}
          {goal.targetDate && (
            <>
              {" · "}
              <time dateTime={goal.targetDate.slice(0, 10)}>
                Due {dateFormat.format(new Date(goal.targetDate))}
              </time>
            </>
          )}
        </span>
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
