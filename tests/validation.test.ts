import { GraphQLError } from "graphql";
import { describe, expect, it } from "vitest";
import { TARGET_SKILL_MAX_LENGTH, TITLE_MAX_LENGTH } from "@/lib/goal-limits";
import { validateAddGoalInput, validateGoalId } from "@/lib/graphql/validation";

function captureError(action: () => unknown): GraphQLError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(GraphQLError);
    return error as GraphQLError;
  }
  throw new Error("Expected the action to throw");
}

describe("validateAddGoalInput", () => {
  it("returns trimmed values", () => {
    expect(validateAddGoalInput({ title: "  Learn hooks ", targetSkill: "\tReact\n" })).toEqual({
      title: "Learn hooks",
      targetSkill: "React",
    });
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
  ])("rejects a title that is %s", (_name, title) => {
    const error = captureError(() => validateAddGoalInput({ title, targetSkill: "React" }));
    expect(error.message).toBe("Title is required.");
    expect(error.extensions).toMatchObject({ code: "BAD_USER_INPUT", field: "title" });
  });

  it("rejects a blank target skill", () => {
    const error = captureError(() => validateAddGoalInput({ title: "Learn", targetSkill: " " }));
    expect(error.message).toBe("Target skill is required.");
    expect(error.extensions).toMatchObject({ code: "BAD_USER_INPUT", field: "targetSkill" });
  });

  it("accepts values exactly at the length limits", () => {
    const input = {
      title: "t".repeat(TITLE_MAX_LENGTH),
      targetSkill: "s".repeat(TARGET_SKILL_MAX_LENGTH),
    };
    expect(validateAddGoalInput(input)).toEqual(input);
  });

  it("rejects values one character over the limits", () => {
    const longTitle = captureError(() =>
      validateAddGoalInput({ title: "t".repeat(TITLE_MAX_LENGTH + 1), targetSkill: "React" }),
    );
    expect(longTitle.extensions.field).toBe("title");

    const longSkill = captureError(() =>
      validateAddGoalInput({ title: "Learn", targetSkill: "s".repeat(TARGET_SKILL_MAX_LENGTH + 1) }),
    );
    expect(longSkill.extensions.field).toBe("targetSkill");
  });

  it("measures the limit after trimming", () => {
    const title = `  ${"t".repeat(TITLE_MAX_LENGTH)}  `;
    expect(validateAddGoalInput({ title, targetSkill: "React" }).title).toHaveLength(TITLE_MAX_LENGTH);
  });
});

describe("validateGoalId", () => {
  it("returns a valid id", () => {
    expect(validateGoalId("abc123")).toBe("abc123");
  });

  it.each(["", "   ", "x".repeat(65)])("rejects %j", (id) => {
    expect(captureError(() => validateGoalId(id)).extensions.code).toBe("BAD_USER_INPUT");
  });
});
