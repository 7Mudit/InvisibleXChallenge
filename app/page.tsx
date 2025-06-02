import { Button } from "@/components/ui/button";
import { auth } from "@clerk/nextjs/server";
import { Link } from "lucide-react";
import { redirect } from "next/navigation";

const HomePage = async () => {
  const { userId } = await auth();

  if (userId) {
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
            <Link href="/sign-in">Get Started</Link>
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
