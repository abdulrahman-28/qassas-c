import { getPublicUser } from "@/lib/server";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
} from "@neondatabase/auth/react";
import AdminDashboard from "@/components/adminDashboard";
import OperatorDashboard from "@/components/operatorDashboard";

// This is the main dashboard page that conditionally renders the admin or operator dashboard based on the user's role.
export default async function Dashboard() {
  const publicUser = await getPublicUser();
  const role = publicUser?.role;

  return (
    <>
      <SignedIn>
        <div>
          {role === "ADMIN" ? <AdminDashboard /> : <OperatorDashboard />}
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
