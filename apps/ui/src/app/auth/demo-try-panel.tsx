import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { env } from "@/env";
import { cn } from "@/lib/utils";
import { DEMO_TEST_CARDS, PROVIDER_LABELS } from "./demo-test-cards";

type DemoTryPanelProps = {
  /** `brand`: always open, in the brand column of wide screens. `compact`: collapsed, under the form on small screens. */
  variant: "brand" | "compact";
};

function PanelBody({ variant }: DemoTryPanelProps) {
  const { t } = useTranslation();
  const provider = env.VITE_PAYMENT_PROVIDER;
  const onBrand = variant === "brand";

  return (
    <div className="space-y-3 text-sm">
      <p>{t("auth.demo.intro")}</p>
      <div>
        <p className="font-medium">
          {t("auth.demo.cardsTitle", { provider: PROVIDER_LABELS[provider] })}
        </p>
        <ul className="mt-2 space-y-2">
          {DEMO_TEST_CARDS[provider].map((card) => (
            <li
              className={cn(
                "rounded-md border p-3",
                onBrand ? "border-primary-foreground/30" : "border-border",
              )}
              key={card.id}
            >
              <p className="font-medium">
                {card.brand} ·{" "}
                {card.outcome === "approved"
                  ? t("auth.demo.outcome.approved")
                  : t("auth.demo.outcome.declined")}
              </p>
              <code className="block font-mono text-base tracking-wide">{card.number}</code>
              <p className={onBrand ? "text-primary-foreground/90" : "text-muted-foreground"}>
                {t("auth.demo.cardDetails", {
                  expiry: card.expiry ?? t("auth.demo.anyFutureDate"),
                  cvc: card.cvc ?? t("auth.demo.anyCvc"),
                })}
                {card.holder ? ` · ${t("auth.demo.cardholder", { holder: card.holder })}` : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <p className={onBrand ? "text-primary-foreground/90" : "text-muted-foreground"}>
        {t("auth.demo.dataReset")}
      </p>
    </div>
  );
}

/**
 * "How to try the demo" panel of the auth pages (docs/demo.md). Shows the test
 * cards of the active payment sandbox. It never shows the demo admin credentials.
 */
export function DemoTryPanel({ variant }: DemoTryPanelProps) {
  const { t } = useTranslation();

  if (!env.VITE_DEMO_MODE) {
    return null;
  }

  if (variant === "brand") {
    return (
      <section
        aria-label={t("auth.demo.title")}
        className="rounded-lg bg-primary-foreground/10 p-5 text-primary-foreground"
      >
        <p className="mb-3 flex items-center gap-2 font-semibold text-lg">
          <FlaskConical aria-hidden="true" className="size-5" />
          {t("auth.demo.title")}
        </p>
        <PanelBody variant="brand" />
      </section>
    );
  }

  return (
    <details className="rounded-lg border bg-card p-4 text-card-foreground">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold">
        <FlaskConical aria-hidden="true" className="size-4" />
        {t("auth.demo.title")}
      </summary>
      <div className="mt-3">
        <PanelBody variant="compact" />
      </div>
    </details>
  );
}
