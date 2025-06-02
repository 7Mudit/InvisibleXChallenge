import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-muted/20">
      <div className="w-full max-w-md p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome Back
          </h1>
          <p className="text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

        <div className="bg-card/80 backdrop-blur-lg border border-border/50 rounded-2xl shadow-2xl p-2">
          <SignIn
            appearance={{
              elements: {
                formButtonPrimary:
                  "bg-primary hover:bg-primary/90 text-primary-foreground",
                card: "bg-transparent shadow-none border-none",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton:
                  "bg-muted/50 border-border/50 hover:bg-muted/70",
                formFieldInput: "bg-background/50 border-border/50",
                footerActionLink: "text-primary hover:text-primary/80",
              },
            }}
          />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Only @invisible.email accounts are allowed
          </p>
        </div>
      </div>
    </div>
  );
}
