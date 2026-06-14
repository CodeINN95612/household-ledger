/** Tiny inline pill shown when a shared-living figure is forecast, not settled. */
export function EstimatedBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-amber-700"
      title="Estimated — actual amount depends on income entries"
    >
      Est.
    </span>
  );
}
