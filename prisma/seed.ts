import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const seedGoals = [
  { title: "Finish the official Next.js tutorial", targetSkill: "Next.js", done: true },
  { title: "Write a schema and resolvers from scratch", targetSkill: "GraphQL", done: false },
  { title: "Model a one-to-many relation", targetSkill: "Prisma", done: false },
  { title: "Shrink an image with a multi-stage build", targetSkill: "Docker", done: false },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    // Only seed an empty table, so restarting never duplicates goals.
    const existing = await prisma.goal.count();
    if (existing > 0) {
      console.log(`Skipping seed: ${existing} goal(s) already exist.`);
      return;
    }
    const { count } = await prisma.goal.createMany({ data: seedGoals });
    console.log(`Seeded ${count} goals.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
