import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface InviteBody {
  full_name: string;
  email: string;
  position?: string;
  phone?: string;
  start_date?: string;
  hourly_rate_cents: number;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can add employees." }, { status: 403 });
  }

  const body = (await request.json()) as Partial<InviteBody>;

  if (!body.full_name || !body.email || body.hourly_rate_cents == null) {
    return NextResponse.json(
      { error: "Full name, email, and hourly rate are required." },
      { status: 400 }
    );
  }
  if (body.hourly_rate_cents < 0) {
    return NextResponse.json({ error: "Hourly rate can't be negative." }, { status: 400 });
  }

  const admin = createAdminClient();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    body.email,
    { redirectTo: `${siteUrl}/accept-invite` }
  );

  if (inviteError || !invited.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "Couldn't send the invite." },
      { status: 400 }
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    role: "employee",
    full_name: body.full_name,
    email: body.email,
    position: body.position || null,
    phone: body.phone || null,
    start_date: body.start_date || null,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: "Couldn't create the employee profile." }, { status: 400 });
  }

  const { error: rateError } = await admin.from("pay_rates").insert({
    employee_id: invited.user.id,
    hourly_rate_cents: body.hourly_rate_cents,
    effective_from: new Date().toISOString().slice(0, 10),
  });

  if (rateError) {
    return NextResponse.json(
      { error: "Employee created, but the hourly rate couldn't be saved. Set it from their profile." },
      { status: 207 }
    );
  }

  return NextResponse.json({ id: invited.user.id });
}
