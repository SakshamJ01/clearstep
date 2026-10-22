import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/compose");
  return <AuthForm mode="signup" />;
}
