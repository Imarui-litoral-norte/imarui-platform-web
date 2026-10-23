import { redirect } from "next/navigation";
import { APP_ROUTES } from "@/shared/config/routes";
export default function Page() { redirect(APP_ROUTES.IAM_IDENTITY); }
