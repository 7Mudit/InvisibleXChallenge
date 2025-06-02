import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";
import { CreateTaskSchema } from "@/lib/schemas/task";
import { generateTaskId } from "@/lib/utils/task-utils";
import { clerkClient } from "@clerk/nextjs/server";

export const tasksRouter = router({
  // Create new task
  create: protectedProcedure
    .input(CreateTaskSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        console.log(input);
        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User email not found",
          });
        }

        const taskID = generateTaskId();

        return {
          taskId: taskID,
          // recordId: input.id,
          message: "Task created successfully",
        };
      } catch (error) {
        console.error("Error creating task:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create task",
        });
      }
    }),
});
