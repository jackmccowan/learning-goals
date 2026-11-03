# Code walkthrough

This guide explains how the app works if you know C# and Flutter but are new to React and Next.js. Open the linked files as you read.

## The big picture

| This project | Closest thing you know |
| --- | --- |
| TypeScript | C#, with types that exist only at compile time |
| React function component | Flutter widget, with the function body acting as `build()` |
| `useState` | `setState` plus a field on a `State` class |
| `useEffect` | `initState` and `dispose` |
| Next.js | ASP.NET Core with built-in routing and server rendering |
| Route handler | ASP.NET minimal API endpoint |
| GraphQL Yoga | Hot Chocolate |
| Prisma | Entity Framework Core |
| Vitest | xUnit, with Moq-style mocks built in |
| `npm` and `package.json` | NuGet and `.csproj`, or `pub` and `pubspec.yaml` |
| `async` / `await` and `Promise<T>` | `async` / `await` and `Task<T>` or `Future<T>` |

Here is what happens when you open the page and tick a goal:

1. The server sends HTML for the page. See [`src/app/page.tsx`](src/app/page.tsx).
2. The browser loads the JavaScript, and [`GoalsApp`](src/components/GoalsApp.tsx) fetches the goals.
3. Ticking a checkbox calls `handleToggle`, which sends a GraphQL mutation through [`goals-api.ts`](src/lib/goals-api.ts).
4. [`route.ts`](src/app/api/graphql/route.ts) passes the request to Yoga, which calls the `toggleGoal` resolver in [`resolvers.ts`](src/lib/graphql/resolvers.ts).
5. The resolver updates Postgres through Prisma and returns the goal.
6. `GoalsApp` updates its state, and React redraws what changed.

## The App Router

Next.js builds its routes from the folder structure inside [`src/app`](src/app). Specific filenames have specific jobs:

| File | Job |
| --- | --- |
| [`src/app/layout.tsx`](src/app/layout.tsx) | Wraps every page with `<html>` and `<body>`, and sets the page title. Think of `MaterialApp` or `_Layout.cshtml`. |
| [`src/app/page.tsx`](src/app/page.tsx) | The UI for `/`. A file at `app/about/page.tsx` would serve `/about`. |
| [`src/app/api/graphql/route.ts`](src/app/api/graphql/route.ts) | An HTTP endpoint at `/api/graphql`, with no UI. |
| [`src/app/icon.svg`](src/app/icon.svg) | Automatically becomes the favicon. |

Other files in `src`, such as `src/components` and `src/lib`, don't create routes. They're ordinary modules you import. `@/` is a path alias for `src/`, set in [`tsconfig.json`](tsconfig.json).

## Server and client components

This idea has no direct equivalent in Flutter, so it's worth taking slowly. A Flutter widget always runs on the device. A React component in Next.js can run in one of two places:

- **Server components** are the default. They run on the server and send only HTML, so their code never reaches the browser. They can't respond to clicks or hold state.
- **Client components** start with `"use client"` at the top of the file. They're also rendered to HTML first, then run in the browser, where they can hold state and handle events.

In this app, [`page.tsx`](src/app/page.tsx) is a server component. Its heading never changes, so it needs no browser code:

```tsx
export default function HomePage() {
  return (
    <main className="page">
      <header className="page-header">...</header>
      <GoalsApp />
    </main>
  );
}
```

[`GoalsApp`](src/components/GoalsApp.tsx), [`GoalForm`](src/components/GoalForm.tsx) and [`GoalItem`](src/components/GoalItem.tsx) are client components, because they need clicks and state. The heading therefore appears straight away from the HTML, while the list follows once the browser has fetched it.

The syntax that looks like HTML inside TypeScript is **JSX**. `<GoalItem goal={goal} busy={false} />` is like `GoalItem(goal: goal, busy: false)` in Dart. Those arguments are called **props**. Because `class` is a reserved word in JavaScript, JSX uses `className` for the CSS class.

## React state and hooks

Hooks are functions whose names start with `use`. They give a function component the abilities a Flutter `State` class would have.

One difference matters most: **React calls your whole component function again on every re-render**, just as Flutter calls `build()` again. Ordinary local variables are recreated each time, so anything that must survive between renders goes in a hook.

### `useState`

In [`GoalForm.tsx`](src/components/GoalForm.tsx):

```tsx
const [title, setTitle] = useState("");
```

This returns the current value and a function to change it. Calling `setTitle("x")` stores the value and schedules a re-render, much like `setState(() => title = "x")`.

The inputs are **controlled**, meaning React state holds their value. It's the same idea as binding a `TextEditingController`, except that you handle every keystroke explicitly:

```tsx
<input value={title} onChange={(event) => setTitle(event.target.value)} />
```

### Never mutate state

React detects changes by comparing references, so changing a list in place wouldn't redraw anything. Always build a new value, as [`GoalsApp.tsx`](src/components/GoalsApp.tsx) does:

```tsx
setGoals((current) => [created, ...current]);                  // add
setGoals((current) => current.map((g) => (g.id === id ? updated : g))); // replace
setGoals((current) => current.filter((g) => g.id !== id));     // remove
```

Passing a function gives you the latest state, which is the safe choice after an `await`, because other updates may have happened while you waited.

### `useEffect`

`useEffect` runs code after the component has appeared on screen. Here it loads the goals:

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetchGoals(controller.signal).then(/* store the goals */);
  return () => controller.abort(); // cleanup
}, []);
```

- The function body is like `initState`.
- The function it returns is like `dispose`. `AbortController` works like a C# `CancellationTokenSource`.
- The `[]` is the dependency list. Empty means "only when first shown". If it held a value, the effect would re-run whenever that value changed.

In development, React deliberately runs effects twice to expose missing cleanup. If you see two requests in the browser's network tab under `npm run dev`, that's the reason.

### Lists and conditional UI

There's no `ListView.builder`. You use normal JavaScript:

```tsx
{goals.map((goal) => (
  <GoalItem key={goal.id} goal={goal} ... />
))}
```

`key` does the same job as a `Key` in Flutter: it tells React which row is which when the list changes. `{loading && <p>...</p>}` shows the paragraph only when `loading` is true.

### Where state lives

`GoalsApp` owns the goal list, and its children receive data and callbacks as props. `GoalItem` doesn't know about GraphQL. It simply calls `onToggle(goal.id)`. This is the same "lift state up" pattern as passing callbacks to child widgets in Flutter.

## The GraphQL schema and resolvers

REST has many URLs, while GraphQL has one endpoint and a typed schema. The client asks for exactly the fields it wants.

### Schema

[`src/lib/graphql/schema.ts`](src/lib/graphql/schema.ts) defines the API contract:

```graphql
type Query {
  goals: [Goal!]!
}

type Mutation {
  addGoal(input: AddGoalInput!): Goal!
  toggleGoal(id: ID!): Goal!
  deleteGoal(id: ID!): ID!
}
```

`!` means non-null, so `[Goal!]!` is like a non-nullable `List<Goal>` in Dart. **Queries** read data and **mutations** change it.

### Resolvers

[`src/lib/graphql/resolvers.ts`](src/lib/graphql/resolvers.ts) contains the functions that fulfil each schema field, a bit like controller actions. Each one receives the parent object (unused here), the arguments and a **context**:

```ts
deleteGoal: async (_parent, args, { db }) => {
  const id = validateGoalId(args.id);
  const { count } = await db.goal.deleteMany({ where: { id } });
  if (count === 0) {
    throw goalNotFound(id);
  }
  return id;
},
```

Three details to notice:

- **Context works as dependency injection.** `db` is created per request in [`route.ts`](src/app/api/graphql/route.ts). Resolvers depend on the small `GoalStore` interface, so tests can pass a fake. TypeScript's typing is *structural*: the real Prisma client satisfies `GoalStore` because it has the right shape, without declaring `implements`.
- **Dates become strings.** The `Goal.createdAt` resolver converts a `Date` to ISO 8601, because the schema declares it a `String`.
- **Toggle guards against a race.** It only writes if `done` still has the value it just read, and tries again if not. This is the same idea as an optimistic concurrency token in EF Core.

### Validation and errors

[`src/lib/graphql/validation.ts`](src/lib/graphql/validation.ts) trims input and enforces the limits. Schema types can only say "this is a string", not "this isn't blank".

Throwing a `GraphQLError` sends its message to the client. Any other exception is hidden by Yoga and appears as "Unexpected error." In the UI, this means "Title is required." shows up in the error banner, while a database password in an error message would not.

GraphQL often returns HTTP 200 even when an operation failed, with the errors in the JSON body. That's why [`goals-api.ts`](src/lib/goals-api.ts) checks `errors` in the body instead of relying only on the status code.

### Connecting it to Next.js

[`route.ts`](src/app/api/graphql/route.ts) creates the Yoga server and exports it under the HTTP methods Next.js looks for:

```ts
export { handler as GET, handler as POST, handler as OPTIONS };
```

An exported function named `POST` is how you say "handle POST requests here", similar to `app.MapPost(...)`.

## Prisma

Prisma has a similar role to EF Core, with one difference: the model lives in its own schema file instead of C# classes.

| File | Job | EF Core equivalent |
| --- | --- | --- |
| [`prisma/schema.prisma`](prisma/schema.prisma) | Defines the `Goal` table | Entity classes and `DbContext` |
| [`prisma/migrations/`](prisma/migrations) | SQL for each schema change | Migrations folder |
| [`prisma/seed.ts`](prisma/seed.ts) | Adds starter goals to an empty table | `HasData` or a seeding script |
| [`prisma.config.ts`](prisma.config.ts) | Tells the CLI where everything is, and the database URL | Connection string setup |
| [`src/lib/prisma.ts`](src/lib/prisma.ts) | Creates the shared client | Registering `DbContext` |

`npx prisma generate` reads the schema and writes a fully typed client to `src/generated/prisma`. That folder isn't committed, and `npm install` regenerates it. So `db.goal.findMany(...)` has full autocomplete, and a typo in a field name is a compile error.

[`src/lib/prisma.ts`](src/lib/prisma.ts) does two things you might wonder about:

- It creates the client lazily, on first use, so `next build` doesn't need a database.
- It keeps the client on `globalThis`, because hot reload in development re-runs modules, and each reload would otherwise open a new connection pool.

To change the schema, edit `schema.prisma` and run `npx prisma migrate dev --name describe_the_change`. This is like `dotnet ef migrations add` followed by `dotnet ef database update`.

## The tests

The tests are in [`tests/`](tests) and don't need a database.

- [`validation.test.ts`](tests/validation.test.ts) tests the validation functions directly, including exact length limits.
- [`resolvers.test.ts`](tests/resolvers.test.ts) sends real GraphQL requests through the real schema, using an in-memory fake store. This also covers the schema and error handling, not just the resolver functions.

`describe` groups tests like a test class, `it` is like `[Fact]`, and `it.each` is like `[Theory]`. `vi.fn` creates a mock function, similar to Moq.

[`vitest.config.ts`](vitest.config.ts) sets custom resolve conditions, and a comment there explains why. Without them, the tests load two copies of the `graphql` package, and Yoga hides every validation error because `instanceof` fails across the copies.

Run the tests with `npm test`, or `npm run test:watch` to re-run on save.

## The Dockerfile

[`Dockerfile`](Dockerfile) is a multi-stage build, the same idea as the `dotnet restore`, `publish` and runtime stages in a .NET Dockerfile. Each stage can build on the previous one:

| Stage | Based on | What it does |
| --- | --- | --- |
| `deps` | `node:24-bookworm-slim` | Installs all packages with `npm ci`, like `dotnet restore` from a lock file |
| `builder` | `deps` | Generates the Prisma client and runs `next build` |
| `migrator` | `builder` | Keeps the dev tools, and runs migrations and the seed when started |
| `runner` | a fresh `node` image | Copies only the build output and runs it |

The `runner` stage is what makes the image small. Setting `output: "standalone"` in [`next.config.ts`](next.config.ts) makes Next.js produce a minimal `server.js` with only the packages it needs. Build tools and source code stay behind in the earlier stages. It also runs as the non-root `node` user.

Dependency files are copied before the source code so Docker can reuse the cached `npm ci` layer when only your code changes.

[`docker-compose.yml`](docker-compose.yml) runs the stages together. `target: migrator` and `target: runner` choose which stage each service uses. The `depends_on` conditions create the start-up order: `db` must be healthy, then `migrate` must exit successfully, and only then does `app` start.

Inside Compose, the app reaches Postgres at the hostname `db`, not `localhost`, because each container has its own network. That's why `DATABASE_URL` differs between [`docker-compose.yml`](docker-compose.yml) and [`.env.example`](.env.example).

## The CI workflow

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) tells GitHub Actions what to run. It's similar to a `Jenkinsfile` or an Azure Pipelines YAML file:

- **`on: push` and `pull_request`** are the triggers.
- **`permissions: contents: read`** limits the workflow to reading the repository.
- **`runs-on: ubuntu-latest`** gives each run a fresh virtual machine.
- **`uses:`** steps run shared actions: one checks out the code, the other installs the Node version in [`.nvmrc`](.nvmrc).
- **`run:`** steps are shell commands: `npm ci`, then lint, type-check, test and build.

`npm ci` installs exactly what's in `package-lock.json`, and is the right choice for automated builds. `npm install` may update the lock file, so use it when you're developing.

## Where to change things

| To change | Edit |
| --- | --- |
| The page layout or heading | [`src/app/page.tsx`](src/app/page.tsx) |
| How the goal list behaves | [`src/components/GoalsApp.tsx`](src/components/GoalsApp.tsx) |
| The look of the app | [`src/app/globals.css`](src/app/globals.css) |
| Length limits | [`src/lib/goal-limits.ts`](src/lib/goal-limits.ts) |

To add a field such as `dueDate`, work from the database up to the UI:

1. Add it to [`prisma/schema.prisma`](prisma/schema.prisma) and run `npx prisma migrate dev --name add_due_date`.
2. Add it to the GraphQL types in [`schema.ts`](src/lib/graphql/schema.ts).
3. Add validation in [`validation.ts`](src/lib/graphql/validation.ts) and update `GoalRecord` in [`resolvers.ts`](src/lib/graphql/resolvers.ts).
4. Add it to `GOAL_FIELDS` and the `Goal` type in [`goals-api.ts`](src/lib/goals-api.ts).
5. Show it in [`GoalItem.tsx`](src/components/GoalItem.tsx) and add an input to [`GoalForm.tsx`](src/components/GoalForm.tsx).
6. Add tests, and run `npm run lint`, `npm run typecheck` and `npm test`.
