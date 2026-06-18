import { getPublicUser } from "@/lib/server";
import NavbarContent from "./NavbarContent";

export default async function Navbar() {
  const user = await getPublicUser().catch(() => null);
  const navUser = user ? { username: user.username, role: user.role } : null;
  return <NavbarContent user={navUser} />;
}
