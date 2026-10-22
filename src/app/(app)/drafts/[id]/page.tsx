import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DraftEditor } from "@/components/DraftEditor";
import { getCurrentUser } from "@/lib/auth";
import { getDraft } from "@/lib/drafts";
import { isAiConfigured } from "@/lib/planner/ai";

export const metadata: Metadata = { title: "Review draft" };

export default async function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;
  const draft = getDraft(user.id, id);
  if (!draft) notFound();
  if (draft.approvedPlanId) redirect(`/plans/${draft.approvedPlanId}`);

  return (
    <DraftEditor
      draftId={draft.id}
      content={draft.content}
      outcome={draft.outcome}
      horizonDate={draft.horizonDate}
      availableMinutesPerWeek={draft.availableMinutesPerWeek}
      constraints={draft.constraints ?? ""}
      aiConsent={draft.aiConsent}
      mode={draft.mode}
      fallbackReason={draft.fallbackReason}
      createdAt={draft.createdAt}
      aiAvailable={isAiConfigured()}
      aiPreference={user.aiPreference}
    />
  );
}
