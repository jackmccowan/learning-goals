import { createYoga } from "graphql-yoga";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoalRecord, GoalStore, GraphQLContext } from "@/lib/graphql/resolvers";
import { schema } from "@/lib/graphql/schema";

/** An in-memory stand-in for Prisma with just the methods the resolvers use. */
function createFakeStore(initial: GoalRecord[]) {
  let goals = [...initial];
  const store = {
    goal: {
      findMany: vi.fn<GoalStore["goal"]["findMany"]>(async () =>
        [...goals].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
      findUnique: vi.fn<GoalStore["goal"]["findUnique"]>(
        async ({ where }) => goals.find((goal) => goal.id === where.id) ?? null,
      ),
      create: vi.fn<GoalStore["goal"]["create"]>(async ({ data }) => {
        const goal: GoalRecord = { id: "new-id", done: false, createdAt: new Date("2026-03-01"), ...data };
        goals.push(goal);
        return goal;
      }),
      updateMany: vi.fn<GoalStore["goal"]["updateMany"]>(async ({ where, data }) => {
        const match = goals.find((goal) => goal.id === where.id && goal.done === where.done);
        if (match) {
          match.done = data.done;
        }
        return { count: match ? 1 : 0 };
      }),
      deleteMany: vi.fn<GoalStore["goal"]["deleteMany"]>(async ({ where }) => {
        const before = goals.length;
        goals = goals.filter((goal) => goal.id !== where.id);
        return { count: before - goals.length };
      }),
    },
  };
  return store;
}

const older: GoalRecord = {
  id: "older",
  title: "Older goal",
  targetSkill: "SQL",
  done: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};
const newer: GoalRecord = {
  id: "newer",
  title: "Newer goal",
  targetSkill: "React",
  done: false,
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
};

interface Result {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions?: { code?: string; field?: string } }[];
}

describe("GraphQL API", () => {
  let store: ReturnType<typeof createFakeStore>;

  /** Sends the operation through the real schema, as an HTTP client would. */
  async function run(query: string, variables?: Record<string, unknown>): Promise<Result> {
    const yoga = createYoga<object, GraphQLContext>({
      schema,
      context: () => ({ db: store }),
      logging: false,
    });
    const response = await yoga.fetch("http://test/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    return (await response.json()) as Result;
  }

  beforeEach(() => {
    store = createFakeStore([{ ...older }, { ...newer }]);
  });

  describe("goals query", () => {
    it("lists goals newest first with ISO date strings", async () => {
      const result = await run("{ goals { id title targetSkill done createdAt } }");
      expect(result.errors).toBeUndefined();
      expect(result.data?.goals).toEqual([
        { ...newer, createdAt: "2026-02-01T00:00:00.000Z" },
        { ...older, createdAt: "2026-01-01T00:00:00.000Z" },
      ]);
      expect(store.goal.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "desc" } });
    });
  });

  describe("addGoal mutation", () => {
    const mutation = `mutation Add($input: AddGoalInput!) {
      addGoal(input: $input) { id title targetSkill done }
    }`;

    it("stores trimmed values and starts as not done", async () => {
      const result = await run(mutation, { input: { title: "  Learn Yoga ", targetSkill: " GraphQL " } });
      expect(result.errors).toBeUndefined();
      expect(result.data?.addGoal).toEqual({
        id: "new-id",
        title: "Learn Yoga",
        targetSkill: "GraphQL",
        done: false,
      });
      expect(store.goal.create).toHaveBeenCalledWith({
        data: { title: "Learn Yoga", targetSkill: "GraphQL" },
      });
    });

    it("returns a validation error and writes nothing for a blank title", async () => {
      const result = await run(mutation, { input: { title: "  ", targetSkill: "GraphQL" } });
      expect(result.errors?.[0]?.message).toBe("Title is required.");
      expect(result.errors?.[0]?.extensions).toMatchObject({ code: "BAD_USER_INPUT", field: "title" });
      expect(store.goal.create).not.toHaveBeenCalled();
    });

    it("rejects input missing a required field at the schema level", async () => {
      const result = await run(mutation, { input: { title: "Learn" } });
      expect(result.errors).toHaveLength(1);
      expect(store.goal.create).not.toHaveBeenCalled();
    });
  });

  describe("toggleGoal mutation", () => {
    const mutation = "mutation Toggle($id: ID!) { toggleGoal(id: $id) { id done } }";

    it("flips not done to done", async () => {
      const result = await run(mutation, { id: "newer" });
      expect(result.data?.toggleGoal).toEqual({ id: "newer", done: true });
    });

    it("flips done to not done", async () => {
      const result = await run(mutation, { id: "older" });
      expect(result.data?.toggleGoal).toEqual({ id: "older", done: false });
    });

    it("re-reads and toggles the fresh value if another request got in first", async () => {
      // First write finds `done` has already changed, as if a second tab won the race.
      store.goal.updateMany.mockResolvedValueOnce({ count: 0 });
      store.goal.updateMany.mockResolvedValueOnce({ count: 1 });
      store.goal.findUnique.mockResolvedValueOnce({ ...newer, done: false });
      store.goal.findUnique.mockResolvedValueOnce({ ...newer, done: true });

      const result = await run(mutation, { id: "newer" });

      expect(result.errors).toBeUndefined();
      expect(store.goal.updateMany).toHaveBeenLastCalledWith({
        where: { id: "newer", done: true },
        data: { done: false },
      });
      expect(result.data?.toggleGoal).toEqual({ id: "newer", done: false });
    });

    it("returns CONFLICT after repeatedly losing the race", async () => {
      store.goal.updateMany.mockResolvedValue({ count: 0 });
      const result = await run(mutation, { id: "newer" });
      expect(result.errors?.[0]?.extensions?.code).toBe("CONFLICT");
      expect(store.goal.updateMany).toHaveBeenCalledTimes(3);
    });

    it("returns NOT_FOUND for an unknown id", async () => {
      const result = await run(mutation, { id: "missing" });
      expect(result.errors?.[0]?.extensions?.code).toBe("NOT_FOUND");
      expect(store.goal.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a blank id", async () => {
      const result = await run(mutation, { id: " " });
      expect(result.errors?.[0]?.extensions?.code).toBe("BAD_USER_INPUT");
      expect(store.goal.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("deleteGoal mutation", () => {
    const mutation = "mutation Delete($id: ID!) { deleteGoal(id: $id) }";

    it("deletes the goal and returns its id", async () => {
      const result = await run(mutation, { id: "older" });
      expect(result.data?.deleteGoal).toBe("older");
      const remaining = await run("{ goals { id } }");
      expect(remaining.data?.goals).toEqual([{ id: "newer" }]);
    });

    it("returns NOT_FOUND for an unknown id", async () => {
      const result = await run(mutation, { id: "missing" });
      expect(result.errors?.[0]?.extensions?.code).toBe("NOT_FOUND");
    });

    it("rejects a blank id", async () => {
      const result = await run(mutation, { id: "" });
      expect(result.errors?.[0]?.extensions?.code).toBe("BAD_USER_INPUT");
      expect(store.goal.deleteMany).not.toHaveBeenCalled();
    });
  });

  it("hides unexpected internal errors from clients", async () => {
    store.goal.findMany.mockRejectedValueOnce(new Error("password=hunter2 connection refused"));
    const result = await run("{ goals { id } }");
    expect(result.errors?.[0]?.message).toBe("Unexpected error.");
  });
});
