import { isAdmin } from "@/lib/auth";
import AdminClient from "./AdminClient";
import LoginForm from "./LoginForm";
import WrongAddressGuard from "../WrongAddressGuard";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <>
      <WrongAddressGuard />
      {isAdmin() ? <AdminClient /> : <LoginForm />}
    </>
  );
}
