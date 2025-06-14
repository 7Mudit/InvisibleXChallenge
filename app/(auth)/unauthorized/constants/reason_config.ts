import { EnvelopeOpenIcon } from "@radix-ui/react-icons";
import { AlertTriangle, ShieldAlertIcon, UserX } from "lucide-react";

export const REASON_CONFIG = {
  invalid_email: {
    icon: EnvelopeOpenIcon,
    title: "Invalid Email Domain",
    message:
      "You must sign in using a @invisible.email account to access this platform.",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
  admin_access_denied: {
    icon: ShieldAlertIcon,
    title: "Admin Access Required",
    message:
      "You do not have the required privileges to access this page. Contact your system administrator if you believe this is an error.",
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
  },
  account_suspended: {
    title: "Account Suspended",
    message:
      "Your account has been temporarily suspended. Please contact support for assistance.",
    icon: UserX,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-950/30",
    borderColor: "border-red-300 dark:border-red-800",
  },
  maintenance: {
    title: "System Maintenance",
    message:
      "The platform is currently undergoing maintenance. Please try again later.",
    icon: AlertTriangle,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-950/30",
    borderColor: "border-orange-300 dark:border-orange-800",
  },
};
