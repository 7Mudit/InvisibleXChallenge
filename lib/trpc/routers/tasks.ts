import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";
import {
  addServerFields,
  CreateTaskSchema,
  getDetailedValidationError,
  ServerTaskSchema,
  TaskStatus,
  toAirtableFormat,
} from "@/lib/schemas/task";
import { generateTaskId } from "@/lib/utils/task-utils";
import { clerkClient } from "@clerk/nextjs/server";
import z from "zod";

export const tasksRouter = router({
  create: protectedProcedure
    .input(CreateTaskSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        console.log("Starting task creation");

        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "User email not found. Please ensure your account has a valid email address.",
          });
        }

        if (!userEmail.endsWith("@invisible.email")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Only @invisible.email accounts are authorized to create tasks.",
          });
        }

        const serverData = addServerFields(input, userEmail);

        try {
          const validatedServerData = ServerTaskSchema.parse(serverData);
          const taskID = generateTaskId();
          const airtableData = toAirtableFormat(validatedServerData, taskID);

          console.log("Creating record in Airtable:", taskID);

          const records = await ctx.airtable.tasksTable.create([
            {
              fields: airtableData,
            },
          ]);

          const createdRecord = records[0];

          if (!createdRecord) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create task record.",
            });
          }

          console.log("Task created successfully:", records);

          return {
            success: true,
            taskId: taskID,
            recordId: createdRecord.id,
            message:
              "Task created successfully! You can now view it in your submitted tasks.",
            task: {
              id: createdRecord.id,
              TaskID: taskID,
              Status: "Task Creation" as TaskStatus,
              TrainerEmail: userEmail,
              ...airtableData,
            },
          };
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            console.error("Validation failed:", validationError.errors);

            const errorDetails = getDetailedValidationError(validationError);

            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Validation Error: ${errorDetails.summary}`,
            });
          }

          throw validationError;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Task creation failed:", error);

        if (
          error.error === "INVALID_VALUE_FOR_COLUMN" ||
          error.message?.includes("INVALID_VALUE")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "One or more field values are invalid. Please check your selections and try again.",
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again.",
        });
      }
    }),
});
