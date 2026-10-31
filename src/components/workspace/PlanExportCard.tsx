"use client";

import Link from "next/link";
import { CalendarIcon, DownloadIcon, RotateIcon } from "@/components/Icons";

export interface PlanExportCardProps {
  planId: string;
  archived: boolean;
  onOpenDelete: () => void;
}

export function PlanExportCard({
  planId,
  archived,
  onOpenDelete,
}: PlanExportCardProps) {
  return (
    <div className="card plan-side-card">
      <h3>Keep or leave</h3>
      <p>
        Export a readable copy while you still want it. Deletion removes the
        plan, tasks, notes, and any retained raw dump.
      </p>
      <div className="side-actions">
        <a
          href={`/api/plans/${planId}/export?format=ics`}
          className="btn btn-outline btn-sm"
          download
          id="export-ics-btn"
          title="Add focus steps directly into Google Calendar, Apple Calendar, or Outlook"
        >
          <CalendarIcon />
          Add to Calendar (.ics)
        </a>
        <a
          href={`/api/plans/${planId}/export?format=md`}
          className="btn btn-outline btn-sm"
          download
        >
          <DownloadIcon />
          Export Markdown
        </a>
        <a
          href={`/api/plans/${planId}/export?format=txt`}
          className="btn btn-outline btn-sm"
          download
        >
          <DownloadIcon />
          Export plain text
        </a>
        {!archived ? (
          <Link
            href={`/plans/${planId}/revise`}
            className="btn btn-ghost btn-sm"
          >
            <RotateIcon />
            Preview a re-plan
          </Link>
        ) : null}
        <button
          type="button"
          className="danger-link"
          onClick={onOpenDelete}
        >
          Delete plan
        </button>
      </div>
    </div>
  );
}
