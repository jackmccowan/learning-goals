import { GraphQLError } from "graphql";
import {
  validateAddGoalInput,
  validateGoalId,
  type AddGoalInput,
  type ValidAddGoalInput,
} from "./validation";

export interface GoalRecord {
  id: string;
  title: string;
  targetSkill: string;
  done: boolean;
  targetDate: Date | null;
  createdAt: Date;
}

/**
 * The part of the Prisma client the resolvers need. Depending on this small
 * interface (like injecting an interface in C#) lets tests pass a fake.
 */
export interface GoalStore {
  goal: {
    findMany(args: { orderBy: { createdAt: "desc" } }): Promise<GoalRecord[]>;
    findUnique(args: { where: { id: string } }): Promise<GoalRecord | null>;
    create(args: { data: ValidAddGoalInput }): Promise<GoalRecord>;
    updateMany(args: {
      where: { id: string; done: boolean };
      data: { done: boolean };
    }): Promise<{ count: number }>;
    deleteMany(args: { where: { id: string } }): Promise<{ count: number }>;
  };
}

export interface GraphQLContext {
  db: GoalStore;
}

function goalNotFound(id: string): GraphQLError {
  return new GraphQLError(`Goal "${id}" was not found.`, {
    extensions: { code: "NOT_FOUND" },
  });
}

const MAX_TOGGLE_ATTEMPTS = 3;

export const resolvers = {
  Goal: {
    // GraphQL has no built-in date type, so dates travel as ISO 8601 strings.
    createdAt: (goal: GoalRecord) => goal.createdAt.toISOString(),
    targetDate: (goal: GoalRecord) => goal.targetDate?.toISOString() ?? null,
  },
  Query: {
    goals: (_parent: unknown, _args: unknown, { db }: GraphQLContext) =>
      db.goal.findMany({ orderBy: { createdAt: "desc" } }),
  },
  Mutation: {
    addGoal: (_parent: unknown, args: { input: AddGoalInput }, { db }: GraphQLContext) =>
      db.goal.create({ data: validateAddGoalInput(args.input) }),

    toggleGoal: async (_parent: unknown, args: { id: string }, { db }: GraphQLContext) => {
      const id = validateGoalId(args.id);

      // Only write if `done` is still the value we read. If another request
      // changed it in between, count is 0 and we read again, so two toggles at
      // the same moment flip the goal twice instead of losing one.
      for (let attempt = 0; attempt < MAX_TOGGLE_ATTEMPTS; attempt++) {
        const goal = await db.goal.findUnique({ where: { id } });
        if (!goal) {
          throw goalNotFound(id);
        }
        const done = !goal.done;
        const { count } = await db.goal.updateMany({
          where: { id, done: goal.done },
          data: { done },
        });
        if (count === 1) {
          return { ...goal, done };
        }
      }
      throw new GraphQLError("This goal is being changed elsewhere. Please try again.", {
        extensions: { code: "CONFLICT" },
      });
    },

    deleteGoal: async (_parent: unknown, args: { id: string }, { db }: GraphQLContext) => {
      const id = validateGoalId(args.id);
      const { count } = await db.goal.deleteMany({ where: { id } });
      if (count === 0) {
        throw goalNotFound(id);
      }
      return id;
    },
  },
};
