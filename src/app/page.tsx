import { redirect } from "next/navigation";
import { currentMonthKey } from "@/lib/month";

export default function Home() {
  redirect(`/month/${currentMonthKey()}`);
}
