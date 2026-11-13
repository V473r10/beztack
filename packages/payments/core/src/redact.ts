/**
 * Redaction for text that goes to logs: provider errors echo the email they
 * rejected, and a log line is no place for it.
 */

/** An address (`ana@example.com`) or its percent-encoded form (`ana%40example.com`). */
const EMAIL_IN_TEXT = /[^\s@%"'<>=?&/:]+(?:@|%40)[^\s@"'<>&]+/gi;

/** Long enough for any provider message we have seen, short enough for one log line. */
const DEFAULT_MAX_LENGTH = 300;

/**
 * Replaces every email in `text` with `[email]` and caps the result at
 * `maxLength` characters (an ellipsis marks the cut).
 */
export function redactEmails(text: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  const redacted = text.replace(EMAIL_IN_TEXT, "[email]");
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…` : redacted;
}
