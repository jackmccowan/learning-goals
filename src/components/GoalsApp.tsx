"use client";

import { useEffect, useState } from "react";
import { addGoal, deleteGoal, fetchGoals, toggleGoal, type Goal } from "@/lib/goals-api";
import { GoalForm } from "./GoalForm";
import { GoalItem } from "./GoalItem";

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function GoalsApp() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The ids of goals with a request in flight, so their controls can be disabled.
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  // Load the goals once, after the component first appears in the browser.
  useEffect(() => {
    const controller = new AbortController();
    fetchGoals(controller.signal)
      .then((loaded) => {
        setGoals(loaded);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(messageFrom(loadError));
          setLoading(false);
        }
      });
    // Cleanup: cancel the request if the component goes away first.
    return () => controller.abort();
  }, []);

  function setBusy(id: string, busy: boolean) {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  async function handleAdd(input: { title: string; targetSkill: string }): Promise<boolean> {
    setError(null);
    try {
      const created = await addGoal(input);
      setGoals((current) => [created, ...current]);
      return true;
    } catch (addError) {
      setError(messageFrom(addError));
      return false;
    }
  }

  async function handleToggle(id: string) {
    setError(null);
    setBusy(id, true);
    try {
      const updated = await toggleGoal(id);
      setGoals((current) => current.map((goal) => (goal.id === id ? updated : goal)));
    } catch (toggleError) {
      setError(messageFrom(toggleError));
    } finally {
      setBusy(id, false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setBusy(id, true);
    try {
      await deleteGoal(id);
      setGoals((current) => current.filter((goal) => goal.id !== id));
    } catch (deleteError) {
      setError(messageFrom(deleteError));
    } finally {
      setBusy(id, false);
    }
  }

  const doneCount = goals.filter((goal) => goal.done).length;

  return (
    <>
      <GoalForm onAdd={handleAdd} />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="goals-heading">
        <div className="list-header">
          <h2 id="goals-heading">Your goals</h2>
          {!loading && (
            <p className="count" role="status">
              {doneCount} of {goals.length} done
            </p>
          )}
        </div>

        {loading && <p className="muted">Loading goals…</p>}

        {!loading && goals.length === 0 && !error && (
          <p className="muted">No goals yet. Add your first one above.</p>
        )}

        {goals.length > 0 && (
          <ul className="goal-list">
            {goals.map((goal) => (
              <GoalItem
                key={goal.id}
                goal={goal}
                busy={busyIds.has(goal.id)}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
