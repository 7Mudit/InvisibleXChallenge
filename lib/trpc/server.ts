import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import Airtable from "airtable";
import { AirtableTaskRecord } from "../schemas/task";
import { auth0 } from "@/lib/auth0";

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
  const session = await auth0.getSession();
  return {
    session,
    userId: session?.user?.sub,
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
  if (!ctx.userId || !ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.userId,
    },
  });
});

// Base router and procedures
export const router = t.router;
export const publicProcedure = t.procedure.use(withLogging);
export const protectedProcedure = t.procedure.use(withLogging).use(isAuthed);
