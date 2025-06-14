import { Button } from "@/components/ui/button";
import { auth0 } from "@/lib/auth0";
import { redirect } from "next/navigation";

const HomePage = async () => {
  const session = await auth0.getSession();

  if (session?.user.sub) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-muted/20">
      <div className="text-center space-y-8 max-w-2xl mx-auto p-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground">
            Invisible
          </h1>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto">
            Advanced evaluation platform for professional task assessment
          </p>
        </div>

        <div className="space-y-4">
          <Button size="lg" asChild className="text-lg px-8 py-3">
            <a href="/auth/login">Login</a>
          </Button>

          <p className="text-sm text-muted-foreground">
            Restricted to @invisible.email accounts
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
