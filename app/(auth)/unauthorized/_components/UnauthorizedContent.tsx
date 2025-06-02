"use client";
import { SignedIn, SignOutButton, useUser } from "@clerk/nextjs";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import ReasonDisplay from "./ReasonDisplay";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

const VALID_REASONS = ["invalid_email", "admin_access_denied"];
type ValidReason = (typeof VALID_REASONS)[number];

const UnauthorizedContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, user, isLoaded } = useUser();
  const [isValidAccess, setIsValidAccess] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    const reason = searchParams.get("reason") as ValidReason;

    if (!reason || !VALID_REASONS.includes(reason)) {
      router.push("/");
      return;
    }

    if (isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      const isAdmin = user.publicMetadata?.role === "admin";

      const checkAccess = () => {
        switch (reason) {
          case "invalid_email":
            if (email?.endsWith("@invisible.email")) {
              router.push("/");
              return false;
            }
            break;

          case "admin_access_denied":
            if (isAdmin) {
              router.push("/");
              return false;
            }
            break;
        }

        return true;
      };
      const isValid = checkAccess();
      setIsValidAccess(isValid);
    } else {
      setIsValidAccess(true);
    }
    setIsChecking(false);
  }, [isLoaded, isSignedIn, user, searchParams, router]);

  if (isChecking || !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Verifying access....</p>
        </div>
      </div>
    );
  }

  if (!isValidAccess) {
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirecting to home page....</p>
    </div>;
  }

  return (
    <>
      <div className="min-h-[80vh] flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full p-6 rounded-2xl shadow-xl bg-white dark:bg-zinc-900 border border-border text-center ">
          <div className="flex justify-center mb-4">
            <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Access Denied
          </h1>
          {/* will replace this with a loader */}
          <Suspense
            fallback={<p className="text-muted-foreground mt-2">Loading...</p>}
          >
            <ReasonDisplay />
          </Suspense>
          <div className="mt-6 flex flex-col gap-3">
            <SignedIn>
              <SignOutButton>
                <Button variant="destructive">Sign Out</Button>
              </SignOutButton>
            </SignedIn>

            <Button onClick={() => router.push("/")}>Go Back</Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UnauthorizedContent;
