import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Household Ledger",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
            ₿
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Household Ledger</h1>
          <p className="mt-1 text-sm text-muted">
            Split shared costs by income, settled each month.
          </p>
        </div>

        <div className="rounded-[calc(var(--radius)+2px)] border border-line bg-surface p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
