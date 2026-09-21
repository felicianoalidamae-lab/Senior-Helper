import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { SettingsForm } from "./settings-form";
import { OwnersSection } from "./owners-section";

export default async function SettingsPage() {
  const supabase = createClient();
  const [settings, { data: profiles }] = await Promise.all([
    getSettings(),
    supabase.from("profiles").select("*").order("full_name"),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Settings</h1>
      <div className="mt-4 space-y-6">
        <SettingsForm settings={settings} />
        <OwnersSection profiles={profiles ?? []} />
      </div>
    </div>
  );
}
