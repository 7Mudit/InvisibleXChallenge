import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import Airtable from "airtable";
import { AirtableTaskRecord } from "../schemas/task";

if (!process.env.AIRTABLE_API_KEY) {
  throw new Error("AIRTABLE_API_KEY environment variable is required");
}

if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error("AIRTABLE_BASE_ID environment variable is required");
}

const AirtableBase = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

const tasksTable = AirtableBase<AirtableTaskRecord>(
  process.env.AIRTABLE_TABLE_NAME || "Operator"
);

// Create context for tRPC
export async function createTRPCContext() {
  const { userId } = await auth();
  return {
    userId,
    airtable: {
      tasksTable,
    },
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === "BAD_REQUEST" && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

const withLogging = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();

  console.log(`tRPC ${type} ${path} - Started`);

  const result = await next();

  const durationMs = Date.now() - start;
  console.log(
    `tRPC ${type} ${path} - ${result.ok ? "OK" : "ERROR"} in ${durationMs}ms`
  );

  return result;
});

// Middleware to check if user is authenticated
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

// Base router and procedures
export const router = t.router;
export const publicProcedure = t.procedure.use(withLogging);
export const protectedProcedure = t.procedure.use(withLogging).use(isAuthed);
