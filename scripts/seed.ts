/**
 * Demo data for local development (spec §10): an owner, three employees
 * with different rates/positions, two weeks of time entries (including a
 * multi-break day and a missed clock-out), and a few leave requests in
 * every status.
 *
 * Refuses to run unless NEXT_PUBLIC_SUPABASE_SEED_ALLOW matches the
 * project ref parsed from NEXT_PUBLIC_SUPABASE_URL, so it can't
 * accidentally be pointed at a real business's Supabase project.
 *
 * Usage: NEXT_PUBLIC_SUPABASE_SEED_ALLOW=your-project-ref npm run seed
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowRef = process.env.NEXT_PUBLIC_SUPABASE_SEED_ALLOW;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const projectRef = new URL(url).hostname.split(".")[0];

if (!allowRef || allowRef !== projectRef) {
  console.error(
    `Refusing to seed. Set NEXT_PUBLIC_SUPABASE_SEED_ALLOW=${projectRef} to confirm this is a ` +
      "disposable dev project, not a real one."
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Eastern Time in late September is EDT (UTC-4). Good enough for demo data.
const TZ_OFFSET_HOURS = 4;
function easternTime(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour + TZ_OFFSET_HOURS, minute, 0, 0);
  return d.toISOString();
}
function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

async function upsertPerson(
  email: string,
  fullName: string,
  role: "owner" | "employee",
  position: string | null
) {
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "DemoPass123!",
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(`Couldn't create ${email}: ${error?.message}`);

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role,
    full_name: fullName,
    email,
    position,
    start_date: dateOnly(easternTime(90, 9)),
  });
  if (profileError) throw new Error(`Couldn't create profile for ${email}: ${profileError.message}`);

  return created.user.id as string;
}

async function main() {
  console.log(`Seeding project ${projectRef}...`);

  const ownerId = await upsertPerson("owner@example.com", "Sam Owner", "owner", null);

  const employees = [
    { email: "alice@example.com", name: "Alice Caregiver", position: "Caregiver", rate: 1900 },
    { email: "bob@example.com", name: "Bob Scheduler", position: "Scheduler", rate: 2200 },
    { email: "carol@example.com", name: "Carol Coordinator", position: "Care Coordinator", rate: 2500 },
  ];

  const employeeIds: string[] = [];
  for (const emp of employees) {
    const id = await upsertPerson(emp.email, emp.name, "employee", emp.position);
    employeeIds.push(id);

    const { data: existingRate } = await admin
      .from("pay_rates")
      .select("id")
      .eq("employee_id", id)
      .maybeSingle();
    if (!existingRate) {
      await admin.from("pay_rates").insert({
        employee_id: id,
        hourly_rate_cents: emp.rate,
        effective_from: dateOnly(easternTime(90, 9)),
      });
    }
  }

  const [aliceId, bobId, carolId] = employeeIds;

  // Two weeks of weekday time entries for everyone (skip weekends).
  for (let daysAgo = 13; daysAgo >= 1; daysAgo--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    const dow = d.getUTCDay(); // 0 = Sun, 6 = Sat
    if (dow === 0 || dow === 6) continue;

    for (const employeeId of employeeIds) {
      const clockIn = easternTime(daysAgo, 9);
      const clockOut = easternTime(daysAgo, 17, 5);

      const { data: entry, error } = await admin
        .from("time_entries")
        .insert({
          employee_id: employeeId,
          work_date: dateOnly(clockIn),
          clock_in: clockIn,
          clock_out: clockOut,
          source: "live",
        })
        .select()
        .single();
      if (error) {
        console.warn(`Skipping entry for ${employeeId} on day -${daysAgo}: ${error.message}`);
        continue;
      }

      if (employeeId === aliceId && daysAgo === 6) {
        // Multiple breaks in one day.
        await admin.from("breaks").insert([
          { time_entry_id: entry.id, break_start: easternTime(daysAgo, 10, 30), break_end: easternTime(daysAgo, 10, 45) },
          { time_entry_id: entry.id, break_start: easternTime(daysAgo, 12, 30), break_end: easternTime(daysAgo, 13, 0) },
          { time_entry_id: entry.id, break_start: easternTime(daysAgo, 15, 0), break_end: easternTime(daysAgo, 15, 10) },
        ]);
      } else {
        await admin.from("breaks").insert({
          time_entry_id: entry.id,
          break_start: easternTime(daysAgo, 12, 0),
          break_end: easternTime(daysAgo, 12, 30),
        });
      }
    }
  }

  // Bob missed his clock-out two days ago (still an open entry today).
  const { data: bobHasOpen } = await admin
    .from("time_entries")
    .select("id")
    .eq("employee_id", bobId)
    .is("clock_out", null)
    .maybeSingle();
  if (!bobHasOpen) {
    await admin.from("time_entries").insert({
      employee_id: bobId,
      work_date: dateOnly(easternTime(2, 9)),
      clock_in: easternTime(2, 9),
      clock_out: null,
      source: "live",
    });
  }

  // Leave requests in every status.
  await admin.from("leave_requests").insert([
    {
      employee_id: aliceId,
      type: "vacation",
      start_date: dateOnly(easternTime(-14, 9)),
      end_date: dateOnly(easternTime(-12, 9)),
      reason: "Family trip",
      status: "pending",
    },
    {
      employee_id: bobId,
      type: "sick",
      start_date: dateOnly(easternTime(3, 9)),
      end_date: dateOnly(easternTime(3, 9)),
      reason: "Doctor's appointment",
      status: "approved",
      decided_by: ownerId,
      decided_at: easternTime(4, 9),
    },
    {
      employee_id: carolId,
      type: "emergency",
      start_date: dateOnly(easternTime(20, 9)),
      end_date: dateOnly(easternTime(21, 9)),
      reason: "Family emergency",
      status: "declined",
      decided_by: ownerId,
      decided_at: easternTime(19, 9),
      decision_note: "Short-staffed that week, please pick different dates.",
    },
    {
      employee_id: carolId,
      type: "vacation",
      start_date: dateOnly(easternTime(45, 9)),
      end_date: dateOnly(easternTime(43, 9)),
      reason: "No longer needed",
      status: "cancelled",
    },
  ]);

  console.log("Seed complete:");
  console.log("  Owner:    owner@example.com / DemoPass123!");
  console.log("  Employee: alice@example.com / DemoPass123!");
  console.log("  Employee: bob@example.com / DemoPass123!");
  console.log("  Employee: carol@example.com / DemoPass123!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
