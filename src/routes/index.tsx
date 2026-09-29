import { createFileRoute } from "@tanstack/react-router";
import { MazeGame } from "@/features/mazex/MazeGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MazeX — Escape the Maze" },
      { name: "description", content: "Escape an ever-changing neon maze before the Hunter catches you in this fast-paced survival game." },
      { property: "og:title", content: "MazeX — Escape the Maze" },
      { property: "og:description", content: "Escape the maze. Outrun the Hunter. Every maze has a way out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MazeGame,
});
