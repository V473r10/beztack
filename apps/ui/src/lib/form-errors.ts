type RevealState = {
  /** The form shows field errors only after the user left the field or tried to submit. */
  deferred: boolean;
  isBlurred: boolean;
  submissionAttempts: number;
};

/** Field errors to show: all of them, or none until the field was left or a submit was attempted. */
export function visibleFieldErrors<T>(errors: T[], state: RevealState): T[] {
  if (!state.deferred || state.isBlurred || state.submissionAttempts > 0) {
    return errors;
  }
  return [];
}

type FocusableRoot = {
  querySelector: (selector: string) => { focus: () => void } | null;
};

/** Move focus to the first control of the form marked `aria-invalid`. */
export function focusFirstInvalidField(root: FocusableRoot | null): boolean {
  const invalid = root?.querySelector('[aria-invalid="true"]');
  if (!invalid) {
    return false;
  }
  invalid.focus();
  return true;
}
