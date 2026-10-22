import Link from "next/link";
import { BrandMark } from "@/components/Icons";

export function Brand({
  href = "/",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`brand ${className}`.trim()}>
      <BrandMark className="brand-mark" />
      <span>Clearstep</span>
    </Link>
  );
}
