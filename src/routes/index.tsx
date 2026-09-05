import { createFileRoute } from "@tanstack/react-router";
import { PrismaApp } from "@/components/game/PrismaApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <PrismaApp />;
}
