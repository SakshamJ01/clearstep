import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ReplanPanel,
  type PendingReplanPreview,
} from "@/components/ReplanPanel";
import { getCurrentUser } from "@/lib/auth";
import { getPlanDetail } from "@/lib/plans";
import { getPendingRevision } from "@/lib/revisions";
import { todayIso } from "@/lib/schemas";

export const metadata: Metadata = { title: "Re-plan preview" };

export default async function RevisePlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;
  const plan = getPlanDetail(id, user.id);
  if (!plan) notFound();
  const pending = getPendingRevision(plan.id, user.id);
  const preview: PendingReplanPreview | null = pending
    ? {
        id: pending.id,
        number: pending.number,
        summary: pending.payload.summary,
        changes: pending.changes,
        taskOrder: pending.payload.taskOrder,
        startTaskId: pending.payload.startTaskId,
        horizonDate: pending.payload.horizonDate,
        availableMinutesPerWeek: pending.payload.availableMinutesPerWeek,
        estimatedOpenMinutesMin: pending.payload.estimatedOpenMinutesMin,
        estimatedOpenMinutesMax: pending.payload.estimatedOpenMinutesMax,
        createdAt: pending.createdAt,
      }
    : null;

  return (
    <>
      <section className="page-header">
        <div className="eyebrow">Re-plan</div>
        <h1 className="page-title">Adjust the frame, not the facts.</h1>
        <p className="page-subtitle">
          Change the deadline or the amount of time you really have. Compare the
          proposed order against the current one. Nothing changes until you apply
          the preview.
        </p>
      </section>
      <ReplanPanel plan={plan} preview={preview} today={todayIso()} />
    </>
  );
}
