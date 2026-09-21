/**
 * One-time bootstrap for the first owner account. There is no public
 * sign-up page by design (spec §6.1) — this script is how the very first
 * account gets created; every account after that is invited by an owner
 * from /employees.
 *
 * Usage: npm run create-owner
 * Requires FIRST_OWNER_EMAIL, FIRST_OWNER_PASSWORD, FIRST_OWNER_NAME,
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const email = process.env.FIRST_OWNER_EMAIL;
const password = process.env.FIRST_OWNER_PASSWORD;
const fullName = process.env.FIRST_OWNER_NAME;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password || !fullName || !url || !serviceKey) {
  console.error(
    "Missing env vars. Set FIRST_OWNER_EMAIL, FIRST_OWNER_PASSWORD, FIRST_OWNER_NAME, " +
      "NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in .env.local."
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("FIRST_OWNER_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

async function main() {
  const admin = createClient(url as string, serviceKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    console.error("Couldn't create the auth user:", createError?.message);
    process.exit(1);
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "owner",
    full_name: fullName,
    email,
  });

  if (profileError) {
    console.error("Auth user created, but the profile row failed:", profileError.message);
    process.exit(1);
  }

  console.log(`Owner account created for ${email}. Sign in at /login.`);
}

main();
