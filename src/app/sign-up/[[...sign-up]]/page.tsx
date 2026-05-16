import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { IS_DEV_BYPASS } from "@/lib/dev-auth";

export default function Page() {
  if (IS_DEV_BYPASS) redirect("/onboarding");
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <SignUp />
    </div>
  );
}
