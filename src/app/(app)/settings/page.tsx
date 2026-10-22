import type { Metadata } from "next";
import { SettingsPanel } from "@/components/SettingsPanel";
import { getCurrentUser } from "@/lib/auth";
import { getAccountDataStats } from "@/lib/plans";
import { aiProviderName, isAiConfigured } from "@/lib/planner/ai";
import { getAiUsage } from "@/lib/rate-limit";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const stats = getAccountDataStats(user.id);

  return (
    <SettingsPanel
      email={user.email}
      createdAt={user.createdAt}
      initialPreference={user.aiPreference}
      aiAvailable={isAiConfigured()}
      providerName={aiProviderName() ?? "Configured provider"}
      usage={getAiUsage(user.id)}
      planCount={stats.planCount}
      retainedDumpCount={stats.retainedDumpCount}
    />
  );
}
