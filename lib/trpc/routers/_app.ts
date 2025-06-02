import { router } from "../server";
import { tasksRouter } from "./tasks";

export const appRouter = router({
  tasks: tasksRouter,
});

export type AppRouter = typeof appRouter;
