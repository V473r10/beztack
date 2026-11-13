type InitialsSource = { name?: string | null; email?: string | null };

/** First letters of the first and last word of the name; the email's first letter if no name. */
export function getInitials({ name, email }: InitialsSource): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? [words[0], words.at(-1) ?? ""]
      : words.length === 1
        ? [words[0]]
        : [(email ?? "").trim()];
  return letters
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}
