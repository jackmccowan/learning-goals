/** The browser's typed client for /api/graphql. */

export interface Goal {
  id: string;
  title: string;
  targetSkill: string;
  done: boolean;
  /** ISO 8601 string at midnight UTC, or null when no date was set. */
  targetDate: string | null;
  createdAt: string;
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string }[];
}

const GOAL_FIELDS = "id title targetSkill done targetDate createdAt";

async function request<T>(
  query: string,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  // GraphQL reports most errors in the body, often with a 200 status, so read
  // the body first. It may not be JSON if a proxy or the server itself failed.
  const body = (await response.json().catch(() => null)) as GraphQLResponse<T> | null;
  const firstError = body?.errors?.[0];
  if (firstError) {
    throw new Error(firstError.message);
  }
  if (!response.ok || !body?.data) {
    throw new Error("The server could not be reached. Please try again.");
  }
  return body.data;
}

export async function fetchGoals(signal?: AbortSignal): Promise<Goal[]> {
  const data = await request<{ goals: Goal[] }>(`query Goals { goals { ${GOAL_FIELDS} } }`, undefined, signal);
  return data.goals;
}

export interface NewGoal {
  title: string;
  targetSkill: string;
  /** YYYY-MM-DD, or null for no date. */
  targetDate: string | null;
}

export async function addGoal(input: NewGoal): Promise<Goal> {
  const data = await request<{ addGoal: Goal }>(
    `mutation AddGoal($input: AddGoalInput!) { addGoal(input: $input) { ${GOAL_FIELDS} } }`,
    { input },
  );
  return data.addGoal;
}

export async function toggleGoal(id: string): Promise<Goal> {
  const data = await request<{ toggleGoal: Goal }>(
    `mutation ToggleGoal($id: ID!) { toggleGoal(id: $id) { ${GOAL_FIELDS} } }`,
    { id },
  );
  return data.toggleGoal;
}

export async function deleteGoal(id: string): Promise<string> {
  const data = await request<{ deleteGoal: string }>(
    `mutation DeleteGoal($id: ID!) { deleteGoal(id: $id) }`,
    { id },
  );
  return data.deleteGoal;
}
