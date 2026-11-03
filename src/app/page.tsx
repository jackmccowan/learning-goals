import { GoalsApp } from "@/components/GoalsApp";

// A server component: it runs on the server and sends HTML. The interactive
// part lives in the client component it renders.
export default function HomePage() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>Learning Goals</h1>
        <p className="tagline">Decide what to learn next and keep track of what you have done.</p>
      </header>
      <GoalsApp />
    </main>
  );
}
