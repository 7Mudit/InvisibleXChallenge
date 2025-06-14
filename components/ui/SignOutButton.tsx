"use client";

import { ReactNode } from "react";

interface SignOutButtonProps {
  children: ReactNode;
}

export function SignOutButton({ children }: SignOutButtonProps) {
  return <a href="/auth/logout">{children}</a>;
}
