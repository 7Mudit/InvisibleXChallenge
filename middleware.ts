import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canAccessAdminRoutes, UserRole } from "@/lib/schemas/users.schema";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/unauthorized(.*)",
  "/api/clerk/webhook",
  "/help(.*)",
  "/api/trpc/public(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.pathname;
  const { userId, sessionClaims } = await auth();
  const email: string | undefined = sessionClaims?.email as string;
  const role = sessionClaims?.role;

  if (isPublicRoute(req)) {
    console.debug("Public route hit: ", { url });
    return;
  }

  // no user (not logged in)
  if (!userId) {
    console.warn("No UserID - redirecting to sign-in", { url });
    const redirectURL = new URL("/sign-in", req.url);
    return NextResponse.redirect(redirectURL);
  }

  // deleted user or broken session
  if (!email) {
    console.warn("Session has no email - possibly deleted user", {
      url,
      userId,
    });

    const redirectURL = new URL("/sign-in", req.url);
    return NextResponse.redirect(redirectURL);
  }

  if (!email || !email.endsWith("@invisible.email")) {
    console.warn("Unauthorized email domain", { url, email });
    const redirectURL = new URL("/unauthorized", req.url);
    redirectURL.searchParams.set("reason", "invalid_email");
    return NextResponse.redirect(redirectURL);
  }

  // admin route protection
  if (isAdminRoute(req)) {
    const hasAdminAccess = canAccessAdminRoutes(role as UserRole);

    if (!hasAdminAccess) {
      console.warn("Unauthorized admin access attempt", { url, email, userId });
      const redirectUrl = new URL("/unauthorized", req.url);
      redirectUrl.searchParams.set("reason", "admin_access_denied");
      return NextResponse.redirect(redirectUrl);
    }
  }

  console.info("Authenticated route access", {
    url,
    userId,
    email,
    role,
  });

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
