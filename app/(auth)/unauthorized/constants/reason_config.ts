import {
  EnvelopeOpenIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { ShieldAlertIcon, ShieldBanIcon } from "lucide-react";

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
  insufficient_permissions: {
    icon: ShieldBanIcon,
    title: "Insufficient Permissions",
    message:
      "Your current role doesn't have permission to access this resource.",
    color: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  role_assignment_pending: {
    icon: ExclamationTriangleIcon,
    title: "Role Assignment Pending",
    message:
      "Your account is being processed. Please contact an administrator to complete your setup.",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
};
