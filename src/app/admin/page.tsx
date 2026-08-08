import { isAdmin } from "@/lib/auth";
import AdminClient from "./AdminClient";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return isAdmin() ? <AdminClient /> : <LoginForm />;
}
