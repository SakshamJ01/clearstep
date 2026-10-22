import type { Metadata } from "next";
import { Composer } from "@/components/Composer";
import { aiProviderName, isAiConfigured } from "@/lib/planner/ai";
import { getAiUsage } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { todayIso } from "@/lib/schemas";

export const metadata: Metadata = { title: "New plan" };

export default async function ComposePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <Composer
      userId={user.id}
      today={todayIso()}
      aiAvailable={isAiConfigured()}
      providerName={aiProviderName()}
      aiPreference={user.aiPreference}
      usage={getAiUsage(user.id)}
    />
  );
}
