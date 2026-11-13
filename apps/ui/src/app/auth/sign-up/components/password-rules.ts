const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_RULES = [
  {
    id: "length",
    labelKey: "form.password.requirements.length",
    errorKey: "validation.password.length",
    test: (password: string) => password.length >= MIN_PASSWORD_LENGTH,
  },
  {
    id: "uppercase",
    labelKey: "form.password.requirements.uppercase",
    errorKey: "validation.password.uppercase",
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    labelKey: "form.password.requirements.lowercase",
    errorKey: "validation.password.lowercase",
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    id: "number",
    labelKey: "form.password.requirements.number",
    errorKey: "validation.password.number",
    test: (password: string) => /[0-9]/.test(password),
  },
  {
    id: "special",
    labelKey: "form.password.requirements.special",
    errorKey: "validation.password.special",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
  },
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]["id"];

export function evaluatePasswordRules(
  password: string,
): { id: PasswordRuleId; labelKey: string; errorKey: string; met: boolean }[] {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    labelKey: rule.labelKey,
    errorKey: rule.errorKey,
    met: rule.test(password),
  }));
}
