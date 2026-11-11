import { GraphQLError } from "graphql";
import { TARGET_SKILL_MAX_LENGTH, TITLE_MAX_LENGTH } from "@/lib/goal-limits";

const ID_MAX_LENGTH = 64;

/** Raised for bad input. Yoga passes GraphQLError messages through to the client. */
function badInput(message: string, field: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "BAD_USER_INPUT", field },
  });
}

function requireText(value: string, label: string, field: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw badInput(`${label} is required.`, field);
  }
  if (trimmed.length > maxLength) {
    throw badInput(`${label} must be ${maxLength} characters or fewer.`, field);
  }
  return trimmed;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Optional, so blank or missing means "no date". Anything else must be a real
 * calendar date in YYYY-MM-DD form (what <input type="date"> sends). It is
 * stored as midnight UTC, so the day never shifts with the server's time zone.
 */
function optionalDate(value: string | null | undefined, label: string, field: string): Date | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  const match = DATE_PATTERN.exec(trimmed);
  if (match) {
    const [, year, month, day] = match.map(Number) as [number, number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    // Date.UTC rolls 2026-02-30 over to 2 March, so check nothing rolled over.
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return date;
    }
  }
  throw badInput(`${label} must be a valid date in YYYY-MM-DD format.`, field);
}

export interface AddGoalInput {
  title: string;
  targetSkill: string;
  targetDate?: string | null;
}

export interface ValidAddGoalInput {
  title: string;
  targetSkill: string;
  targetDate: Date | null;
}

export function validateAddGoalInput(input: AddGoalInput): ValidAddGoalInput {
  return {
    title: requireText(input.title, "Title", "title", TITLE_MAX_LENGTH),
    targetSkill: requireText(input.targetSkill, "Target skill", "targetSkill", TARGET_SKILL_MAX_LENGTH),
    targetDate: optionalDate(input.targetDate, "Target date", "targetDate"),
  };
}

export function validateGoalId(id: string): string {
  return requireText(id, "Goal id", "id", ID_MAX_LENGTH);
}
