type AuthFormErrorProps = {
  message: string | null;
};

/**
 * Form-level error of an auth form. The live region stays mounted while empty
 * so screen readers announce the message when it appears.
 */
export function AuthFormError({ message }: AuthFormErrorProps) {
  return (
    <div aria-atomic="true" aria-live="polite">
      {message ? <p className="font-medium text-destructive text-sm">{message}</p> : null}
    </div>
  );
}
