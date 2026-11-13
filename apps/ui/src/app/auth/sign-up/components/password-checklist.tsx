import { Check, Circle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { evaluatePasswordRules } from "./password-rules";

type PasswordChecklistProps = {
  /** Id of the container. The password input references it with `aria-describedby`. */
  id: string;
  password: string;
  /** Mark unmet rules as failed (after the user left the field or tried to submit). */
  showUnmet?: boolean;
};

const STATE_STYLES = {
  met: "text-green-800 dark:text-green-400",
  pending: "text-muted-foreground",
  unmet: "text-destructive",
} as const;

/** Live checklist of the password rules. Unmet rules stay neutral until errors are revealed. */
export function PasswordChecklist({ id, password, showUnmet = false }: PasswordChecklistProps) {
  const { t } = useTranslation();

  return (
    <div id={id}>
      <p className="text-muted-foreground text-sm">{t("form.password.mustContain")}</p>
      <ul className="mt-1 space-y-1 text-sm">
        {evaluatePasswordRules(password).map((rule) => {
          let state: keyof typeof STATE_STYLES = "pending";
          if (rule.met) {
            state = "met";
          } else if (showUnmet) {
            state = "unmet";
          }
          const Icon = { met: Check, pending: Circle, unmet: X }[state];
          const statusKey = {
            met: "form.password.ruleMet",
            pending: "form.password.rulePending",
            unmet: "form.password.ruleUnmet",
          }[state];

          return (
            <li
              className={cn("flex items-center gap-2", STATE_STYLES[state])}
              data-rule={rule.id}
              data-state={state}
              key={rule.id}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span>{t(rule.labelKey)}</span>
              <span className="sr-only">{t(statusKey)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
