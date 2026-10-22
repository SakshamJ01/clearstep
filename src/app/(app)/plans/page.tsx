import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  PlusIcon,
} from "@/components/Icons";
import { getCurrentUser } from "@/lib/auth";
import {
  formatDateTime,
  formatDeadlineRelative,
  pluralize,
} from "@/lib/format";
import { getPlansForUser, type PlanSummary } from "@/lib/plans";
import type { PlanStatus } from "@/lib/schemas";

export const metadata: Metadata = { title: "My plans" };

function statusTone(status: PlanStatus): string {
  if (status === "completed") return "pill pill-acid";
  if (status === "archived") return "pill";
  return "pill pill-forest";
}

function statusLabel(status: PlanStatus): string {
  if (status === "completed") return "Complete";
  if (status === "archived") return "Archived";
  if (status === "active") return "Active";
  return "Draft";
}

function PlanCard({ plan }: { plan: PlanSummary }) {
  return (
    <Link href={`/plans/${plan.id}`} className="card plan-card">
      <div className="plan-card-top">
        <span className={statusTone(plan.status)}>{statusLabel(plan.status)}</span>
        <span className="meta-chip" style={{ fontSize: 10.5 }}>
          <CalendarIcon /> {formatDeadlineRelative(plan.horizonDate)}
        </span>
      </div>
      <h2>{plan.title}</h2>
      <p className="outcome">{plan.desiredOutcome}</p>
      <div className="plan-card-footer">
        <div className="progress">
          <div className="progress-track" aria-hidden="true">
            <div
              className="progress-fill"
              style={{ width: `${plan.progressPercent}%` }}
            />
          </div>
          <span className="progress-label">
            {plan.doneTasks}/{plan.totalTasks} done
          </span>
        </div>
        <span>
          {plan.status === "completed" ? (
            <>
              <CheckIcon
                style={{ width: 12, height: 12, verticalAlign: "-2px" }}
              />{" "}
              Finished
            </>
          ) : (
            `Updated ${formatDateTime(plan.updatedAt)}`
          )}
        </span>
      </div>
    </Link>
  );
}

export default async function PlansPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const plans = getPlansForUser(user.id);
  const active = plans.filter((plan) => plan.status === "active");
  const completed = plans.filter((plan) => plan.status === "completed");
  const archived = plans.filter((plan) => plan.status === "archived");

  return (
    <>
      <header className="plans-head">
        <div>
          <div className="eyebrow">Your plans</div>
          <h1 className="page-title" style={{ marginBottom: 10 }}>
            A small stack of commitments.
          </h1>
          <p className="page-subtitle">
            No scoreboard, no streak, no guilt. Open one plan at a time and leave
            the rest where they are.
          </p>
        </div>
        <Link href="/compose" className="btn btn-primary">
          <PlusIcon />
          New plan
        </Link>
      </header>

      {plans.length === 0 ? (
        <div className="card empty-state">
          <h2>No plans yet</h2>
          <p>
            Start with a brain dump. You will review a draft before anything is
            saved as a plan.
          </p>
          <Link href="/compose" className="btn btn-primary">
            Make the first plan
            <ArrowRightIcon />
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <section className="plans-section" aria-labelledby="active-plans">
              <div className="plans-section-head">
                <h2 id="active-plans">In motion</h2>
                <span className="count">{active.length}</span>
              </div>
              <div className="plans-grid">
                {active.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </section>
          ) : null}

          {completed.length > 0 ? (
            <section className="plans-section" aria-labelledby="completed-plans">
              <div className="plans-section-head">
                <h2 id="completed-plans">Finished</h2>
                <span className="count">{completed.length}</span>
              </div>
              <div className="plans-grid">
                {completed.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </section>
          ) : null}

          {archived.length > 0 ? (
            <details className="archived-details">
              <summary>
                <ArrowDownIcon />
                Archived plans
                <span className="count">{archived.length}</span>
              </summary>
              <div className="plans-grid" style={{ marginTop: 12 }}>
                {archived.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </details>
          ) : null}

          {active.length === 0 && completed.length === 0 ? (
            <div className="card empty-state" style={{ marginBottom: 24 }}>
              <h2>Nothing is in motion</h2>
              <p>
                You have {pluralize(plans.length, "plan")} in your history, but
                none are active right now. Make a new one when you have a next
                step worth naming.
              </p>
              <Link href="/compose" className="btn btn-primary">
                Start a new plan
                <ArrowRightIcon />
              </Link>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
