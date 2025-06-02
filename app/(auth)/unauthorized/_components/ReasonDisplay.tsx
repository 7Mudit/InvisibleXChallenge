import { useSearchParams } from "next/navigation";

const messages = {
  invalid_email:
    "You must sign in using a @invisible.email account to access this platform",
  admin_access_denied:
    "You do not have required privlieges to access this page. Contact your system administrator if you believe this is an error.",
  default: "You are not authorized to access this page",
};

function ReasonDisplay() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const message = messages[reason as keyof typeof messages] || messages.default;

  return <p className="text-muted-foreground mt-2">{message}</p>;
}

export default ReasonDisplay;
