"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { REASON_CONFIG } from "./constants/reason_config";
import { useUser } from "@auth0/nextjs-auth0";
import { LogOut } from "lucide-react";

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useUser();

  const reason = searchParams.get("reason") as keyof typeof REASON_CONFIG;
  const userEmail = searchParams.get("email") || user?.email;

  const config = REASON_CONFIG[reason] || REASON_CONFIG.invalid_email;
  const IconComponent = config.icon;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-muted/20 p-4">
      <div className="w-full max-w-md">
        <div className="bg-card/80 backdrop-blur-lg border border-border/50 rounded-2xl shadow-2xl p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div
              className={`p-4 rounded-full ${config.bgColor} ${config.borderColor} border-2`}
            >
              <IconComponent className={`h-8 w-8 ${config.color}`} />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {config.title}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {config.message}
            </p>
          </div>

          {userEmail && (
            <div className="bg-muted/50 border border-border/30 rounded-lg p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Current Account
              </p>
              <p className="text-sm font-mono text-foreground break-all">
                {userEmail}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {user && (
              <a
                href="/auth/logout"
                className="flex items-center justify-center cursor-pointer "
              >
                <Button variant={"destructive"} className="w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </a>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/")}
            >
              Go to Home
            </Button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            If you believe this is an error try logging out and signing in
            again. If still not resolved, please contact your system
            administrator
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <UnauthorizedContent />
    </Suspense>
  );
}
