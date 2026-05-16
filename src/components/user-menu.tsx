import { UserButton } from "@clerk/nextjs";
import { IS_DEV_BYPASS, DEV_NAME } from "@/lib/dev-auth";

export function UserMenu() {
  if (IS_DEV_BYPASS) {
    return (
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold"
        style={{ background: "var(--accent)", color: "var(--paper)" }}
        aria-label={DEV_NAME}
      >
        {DEV_NAME.charAt(0)}
      </div>
    );
  }
  return <UserButton />;
}
