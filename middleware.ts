import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "./lib/auth0";
import { getUserInfoFromAPI } from "./lib/utils/auth-utils";

export async function middleware(request: NextRequest) {
  const authRes = await auth0.middleware(request);

  // no protection required for auth routes
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return authRes;
  }

  // not protection required for public routes
  if (
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/unauthorized")
  ) {
    return authRes;
  }

  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (request.nextUrl.pathname.startsWith("/dashboard/admin")) {
      const userInfo = await getUserInfoFromAPI(session);
      const userRole = userInfo?.role;

      if (!userRole || userRole !== "admin") {
        console.warn("Unauthorized admin access attempt", {
          url: request.nextUrl.pathname,
          userId: session.user.sub,
          role: userRole,
        });

        const redirectUrl = new URL("/unauthorized", request.url);
        redirectUrl.searchParams.set("reason", "admin_access_denied");
        return NextResponse.redirect(redirectUrl);
      }
    }

    console.log("Authenticated route access", {
      url: request.nextUrl.pathname,
      userId: session.user.sub,
    });
  }

  return authRes;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
