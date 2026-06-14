import { redirect } from "next/navigation";
import { currentMonthKey } from "@/lib/month";

export default function StatementIndexPage() {
  redirect(`/statement/${currentMonthKey()}`);
}
