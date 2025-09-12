import { send, sendWithReact, sendWelcomeEmail, sendPasswordResetEmail, sendSubscriptionConfirmationEmail } from "./lib/send";
import type { SendEmailProps, SendEmailPropsWithReact, EmailResult } from "./lib/send";
import { welcomeEmailTemplate, passwordResetTemplate } from "./lib/templates";

// Email templates (React components - may cause issues in server environment)
import { MyEmail } from "./emails/my-mail";
import { WelcomeEmail } from "./emails/welcome";
import { PasswordResetEmail } from "./emails/password-reset";
import { SubscriptionConfirmationEmail } from "./emails/subscription-confirmation";

export { 
  send,
  sendWithReact,
  // Specific email methods (recommended approach - encapsulates React templates)
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendSubscriptionConfirmationEmail,
  // HTML Templates (fallback for direct server use)
  welcomeEmailTemplate,
  passwordResetTemplate,
  // React Templates (low-level components, use specific methods instead)
  MyEmail,
  WelcomeEmail,
  PasswordResetEmail,
  SubscriptionConfirmationEmail
};

export type { SendEmailProps, SendEmailPropsWithReact, EmailResult };