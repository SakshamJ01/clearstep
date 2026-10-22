import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import { getCurrentUser } from "@/lib/auth";
import { getPlanDetail } from "@/lib/plans";
import { getPendingRevision } from "@/lib/revisions";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const plan = getPlanDetail(id, user.id);
  if (!plan) notFound();
  const pending = getPendingRevision(plan.id, user.id);

  return (
    <PlanWorkspace
      plan={plan}
      welcome={query.welcome === "1"}
      pendingRevision={
        pending
          ? {
              id: pending.id,
              number: pending.number,
              summary: pending.payload.summary,
            }
          : null
      }
    />
  );
}
