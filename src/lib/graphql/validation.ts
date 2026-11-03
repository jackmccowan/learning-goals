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

export interface AddGoalInput {
  title: string;
  targetSkill: string;
}

export function validateAddGoalInput(input: AddGoalInput): AddGoalInput {
  return {
    title: requireText(input.title, "Title", "title", TITLE_MAX_LENGTH),
    targetSkill: requireText(input.targetSkill, "Target skill", "targetSkill", TARGET_SKILL_MAX_LENGTH),
  };
}

export function validateGoalId(id: string): string {
  return requireText(id, "Goal id", "id", ID_MAX_LENGTH);
}
