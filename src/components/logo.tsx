import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt="Senior Helpers Time Tracker"
      width={180}
      height={36}
      priority
      className={className ?? "h-9 w-auto"}
    />
  );
}
