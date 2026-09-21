import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

const NAV_ITEMS = [
  { href: "/clock", label: "Clock" },
  { href: "/leave", label: "Time off" },
  { href: "/history", label: "History" },
  { href: "/team", label: "Team today" },
];

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <AppShell navItems={NAV_ITEMS} fullName={profile.full_name}>
      {children}
    </AppShell>
  );
}
