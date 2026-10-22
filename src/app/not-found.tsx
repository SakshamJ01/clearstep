import Link from "next/link";
import { ArrowRightIcon } from "@/components/Icons";

export default function NotFound() {
  return (
    <main className="container centered-page" id="main">
      <div>
        <div className="big-number">404</div>
        <h1>That page is not here.</h1>
        <p>
          The link may be old, or the plan may have been deleted. Nothing else
          broke.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link href="/compose" className="btn btn-primary">
            Make a new plan
            <ArrowRightIcon />
          </Link>
          <Link href="/plans" className="btn btn-outline">
            See my plans
          </Link>
        </div>
      </div>
    </main>
  );
}
