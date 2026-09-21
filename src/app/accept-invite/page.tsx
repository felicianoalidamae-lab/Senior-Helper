import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { AcceptInviteForm } from "./accept-invite-form";

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <Logo className="h-11 w-auto" />
      <Suspense fallback={<div className="card w-full max-w-sm text-muted">Loading...</div>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
