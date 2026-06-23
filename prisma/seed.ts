import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.signalSource.upsert({
    where: { key: "ai-brainstorming" },
    update: {},
    create: { key: "ai-brainstorming", nome: "AI Brainstorming", tipo: "AI" },
  });
  await prisma.signalSource.upsert({
    where: { key: "manuale" },
    update: {},
    create: { key: "manuale", nome: "Inserimento Manuale", tipo: "MANUALE" },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
