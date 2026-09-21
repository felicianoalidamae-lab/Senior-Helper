import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClockPageData } from "@/lib/data/clock";
import { getSettings } from "@/lib/data/settings";
import { ClockScreen } from "./clock-screen";

export default async function ClockPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [data, settings] = await Promise.all([getClockPageData(user.id), getSettings()]);

  return <ClockScreen data={data} timeZone={settings.timezone} />;
}
