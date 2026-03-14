import type { TribeRule } from "@/db/schema";

export type DriftResult = {
  overallDrift: number;
  domainDrift: Record<string, number>;
};

export function calculateDrift(
  foundingRules: TribeRule[],
  currentRules: TribeRule[]
): DriftResult {
  const domains = ["governance", "economy", "social", "cultural", "external"];
  const domainDrift: Record<string, number> = {};

  for (const domain of domains) {
    const founding = foundingRules.filter((r) => r.domain === domain);
    const current = currentRules.filter((r) => r.domain === domain);

    if (founding.length === 0) {
      domainDrift[domain] = current.length > 0 ? 100 : 0;
      continue;
    }

    let changed = 0;
    for (const fr of founding) {
      const match = current.find(
        (cr) => cr.domain === fr.domain && cr.text === fr.text
      );
      if (!match) changed++;
    }

    // Also count new rules as drift
    const newRules = current.filter(
      (cr) =>
        !founding.some(
          (fr) => fr.domain === cr.domain && fr.text === cr.text
        )
    );

    const totalChanges = changed + newRules.length;
    const totalRules = Math.max(founding.length, current.length);
    domainDrift[domain] = Math.min(
      100,
      (totalChanges / totalRules) * 100
    );
  }

  const overallDrift =
    Object.values(domainDrift).reduce((sum, d) => sum + d, 0) /
    domains.length;

  return { overallDrift, domainDrift };
}
