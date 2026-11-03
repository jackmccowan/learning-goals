import { createYoga } from "graphql-yoga";
import { schema } from "@/lib/graphql/schema";
import type { GraphQLContext } from "@/lib/graphql/resolvers";
import { getPrisma } from "@/lib/prisma";

const yoga = createYoga<object, GraphQLContext>({
  schema,
  graphqlEndpoint: "/api/graphql",
  // The UI is same-origin, so don't invite other websites to call this API.
  cors: false,
  // The GraphQL IDE is a development aid: don't serve it in production.
  graphiql: process.env.NODE_ENV !== "production",
  fetchAPI: { Response },
  context: () => ({ db: getPrisma() }),
});

// Next.js calls these exports by HTTP method. Yoga works with standard
// Request and Response objects, so it just needs the request handed over.
function handler(request: Request): Response | Promise<Response> {
  return yoga.handleRequest(request, {});
}

export { handler as GET, handler as POST, handler as OPTIONS };
