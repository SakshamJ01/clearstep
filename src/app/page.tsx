import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  FlagIcon,
  LockIcon,
  SparkIcon,
} from "@/components/Icons";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Clearstep — from brain dump to first step",
};

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="landing">
      <header className="site-header">
        <div className="container public-nav">
          <Brand />
          <div className="row">
            {user ? (
              <>
                <Link href="/plans" className="btn btn-ghost">
                  My plans
                </Link>
                <Link href="/compose" className="btn btn-primary">
                  Open composer
                  <ArrowRightIcon />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">
                  Sign in
                </Link>
                <Link href="/signup" className="btn btn-primary">
                  Start with a dump
                  <ArrowRightIcon />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        <section className="container hero">
          <div className="hero-copy">
            <div className="eyebrow">A quieter way to plan</div>
            <h1>
              Get it out of your head. Then take{" "}
              <span className="hero-em">one clear step.</span>
            </h1>
            <p className="hero-lede">
              Clearstep turns a messy brain dump into a small, editable plan. It
              separates what you wrote from what it inferred, never hides the
              seams, and waits for your approval before anything becomes a task.
            </p>
            <div className="hero-actions">
              <Link
                href={user ? "/compose" : "/signup"}
                className="btn btn-primary btn-lg"
              >
                {user ? "Start a new plan" : "Turn a dump into a plan"}
                <ArrowRightIcon />
              </Link>
              <a href="#how" className="btn btn-outline btn-lg">
                See how it works
              </a>
            </div>
            <div className="trust-row">
              <span>
                <CheckIcon /> AI is off by default
              </span>
              <span>
                <CheckIcon /> Nothing activates until you approve
              </span>
              <span>
                <CheckIcon /> Export or delete anytime
              </span>
            </div>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="dump-paper">
              <div className="dump-head">
                <span className="mono-label">The dump · 9:42pm</span>
                <span className="pill pill-danger">unfiltered</span>
              </div>
              <ul className="dump-scribbles">
                <li>renew passport before the trip, I keep forgetting</li>
                <li>ask Sam about splitting the rent??</li>
                <li>portfolio still not started and everyone has one</li>
                <li>call the dentist, it&apos;s been&hellip; a while</li>
                <li className="faint">figure out what I actually want</li>
              </ul>
            </div>

            <div className="art-arrow">
              <ArrowRightIcon />
            </div>

            <div className="plan-paper">
              <div className="mini-plan-head">
                <span className="pill pill-acid">Start here</span>
                <span className="mono-label">draft</span>
              </div>
              <div className="mini-plan-title">Get the flat admin sorted</div>
              <div className="mini-task" data-done="false">
                <span className="mini-check">✓</span>
                <span className="mini-task-title">Message Sam about rent share</span>
                <span className="mini-effort">10–20m</span>
              </div>
              <div className="mini-task" data-done="false">
                <span className="mini-check">✓</span>
                <span className="mini-task-title">Find passport photo requirements</span>
                <span className="mini-effort">15–30m</span>
              </div>
              <div className="mini-task" data-done="true">
                <span className="mini-check">✓</span>
                <span className="mini-task-title">Book dentist appointment</span>
                <span className="mini-effort">5–10m</span>
              </div>
              <div className="mini-assumption">
                Assumption: the rent message can wait until after work. Check
                it.
              </div>
            </div>
          </div>
        </section>

        <section className="steps-band" id="how">
          <div className="container steps-grid">
            <div className="step-item">
              <span className="step-number">01</span>
              <h3>Dump it without sorting.</h3>
              <p>
                One big text box. Half-thoughts, contradictions, the thing you
                have been avoiding. No categories or project setup first.
              </p>
            </div>
            <div className="step-item">
              <span className="step-number">02</span>
              <h3>See what was inferred.</h3>
              <p>
                Your stated facts stay separate from assumptions. Every task is
                editable. Delete what does not belong, or start from a manual
                draft instead.
              </p>
            </div>
            <div className="step-item">
              <span className="step-number">03</span>
              <h3>Approve one next action.</h3>
              <p>
                Nothing becomes active on its own. Approve the plan, then start
                with the smallest feasible step. Re-plan without losing finished
                work.
              </p>
            </div>
          </div>
        </section>

        <section className="container landing-section boundaries">
          <div className="boundaries-copy">
            <div className="eyebrow">A small tool, on purpose</div>
            <h2 className="section-title">
              It organizes. It does not take over.
            </h2>
            <p>
              Clearstep is not a general chatbot and not an autonomous assistant.
              Its job is narrow: make the unstructured thing visible, turn it into
              a draft you can trust, and get you to a real first step.
            </p>
            <p>
              Plans are drafts. You own the decisions, including the decision to
              close the tab and come back later.
            </p>
          </div>
          <ul className="boundary-list">
            <li>
              <span className="boundary-mark">×</span>
              <div>
                <strong>No guilt mechanics</strong>
                <span>
                  No streaks, shame notifications, or productivity theatre. A
                  missed day is just information.
                </span>
              </div>
            </li>
            <li>
              <span className="boundary-mark">×</span>
              <div>
                <strong>No high-stakes pretending</strong>
                <span>
                  Medical, legal, financial, and crisis questions are outside the
                  job. The app points toward appropriate support instead.
                </span>
              </div>
            </li>
            <li>
              <span className="boundary-mark">×</span>
              <div>
                <strong>No silent action</strong>
                <span>
                  It will not email, book, buy, message, or touch your calendar.
                  No agents working behind your back.
                </span>
              </div>
            </li>
            <li>
              <span className="boundary-mark">×</span>
              <div>
                <strong>No endless feed</strong>
                <span>
                  One plan at a time, a finite task list, and a clear place to
                  stop. Busyness is not the goal.
                </span>
              </div>
            </li>
          </ul>
        </section>

        <section className="container privacy-band" id="privacy">
          <div className="privacy-card">
            <div>
              <div className="eyebrow">Privacy, plainly</div>
              <h2>Your brain dump is not content to be mined.</h2>
              <p>
                A dump can contain personal and sensitive things. Clearstep asks
                before sending any of it to an AI provider, never uses it for
                training or advertising, and gives you a manual path that sends
                nothing anywhere.
              </p>
              <ul className="privacy-points">
                <li>
                  <LockIcon />
                  The AI checkbox is off by default, every time.
                </li>
                <li>
                  <LockIcon />
                  Only the active dump and the planning fields you fill in are
                  sent. Never your account history or other plans.
                </li>
                <li>
                  <CheckIcon />
                  Raw dumps are encrypted at rest, automatically cleared after 30
                  days, and can be deleted sooner.
                </li>
                <li>
                  <CheckIcon />
                  Export any plan as Markdown or text. Delete a plan or your whole
                  account permanently.
                </li>
              </ul>
            </div>
            <aside className="privacy-aside">
              <div className="mono">The AI&apos;s job</div>
              <p>
                Produce a bounded JSON draft with a maximum of 20 tasks. The
                server validates every field, caps lengths, rejects malformed
                output, and falls back to a manual template. The model never
                decides what is saved, and generated content is shown as text,
                not executed.
              </p>
              <p>
                Clearstep is not a crisis service or a substitute for
                professional advice. If a dump suggests imminent danger, planning
                pauses and support information is shown instead.
              </p>
            </aside>
          </div>
        </section>

        <section className="container landing-section" style={{ paddingTop: 0 }}>
          <div className="card card-pad-lg row-between">
            <div>
              <div className="eyebrow">A shorter path to starting</div>
              <h2 className="section-title" style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", marginTop: 12 }}>
                What is taking up the most space right now?
              </h2>
            </div>
            <div className="row">
              <Link
                href={user ? "/compose" : "/signup"}
                className="btn btn-primary btn-lg"
              >
                Start with a brain dump
                <SparkIcon />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <Brand />
          <div className="footer-links">
            <a href="#how">How it works</a>
            <a href="#privacy">Privacy</a>
            <Link href="/login">Sign in</Link>
            <span>Clearstep pilot · plans are drafts</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
