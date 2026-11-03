"use client";

import { useState, type FormEvent } from "react";
import { TARGET_SKILL_MAX_LENGTH, TITLE_MAX_LENGTH } from "@/lib/goal-limits";

interface GoalFormProps {
  /** Resolves to true when the goal was saved, so the form knows to clear. */
  onAdd: (input: { title: string; targetSkill: string }) => Promise<boolean>;
}

export function GoalForm({ onAdd }: GoalFormProps) {
  const [title, setTitle] = useState("");
  const [targetSkill, setTargetSkill] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // Stop the browser's default full-page form post.
    setSubmitting(true);
    const saved = await onAdd({ title, targetSkill });
    setSubmitting(false);
    if (saved) {
      setTitle("");
      setTargetSkill("");
    }
  }

  return (
    <form className="goal-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="goal-title">Goal</label>
        <input
          id="goal-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Build a small GraphQL API"
          maxLength={TITLE_MAX_LENGTH}
          autoComplete="off"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="goal-skill">Target skill</label>
        <input
          id="goal-skill"
          value={targetSkill}
          onChange={(event) => setTargetSkill(event.target.value)}
          placeholder="GraphQL"
          maxLength={TARGET_SKILL_MAX_LENGTH}
          autoComplete="off"
          required
        />
      </div>
      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Adding…" : "Add goal"}
      </button>
    </form>
  );
}
