import { createSchema } from "graphql-yoga";
import { resolvers, type GraphQLContext } from "./resolvers";

export const typeDefs = /* GraphQL */ `
  type Goal {
    id: ID!
    title: String!
    targetSkill: String!
    done: Boolean!
    createdAt: String!
  }

  input AddGoalInput {
    title: String!
    targetSkill: String!
  }

  type Query {
    "All goals, newest first."
    goals: [Goal!]!
  }

  type Mutation {
    addGoal(input: AddGoalInput!): Goal!
    toggleGoal(id: ID!): Goal!
    "Returns the id of the deleted goal."
    deleteGoal(id: ID!): ID!
  }
`;

export const schema = createSchema<GraphQLContext>({ typeDefs, resolvers });
