import { send, sendWithReact, sendWelcomeEmail, sendPasswordResetEmail, sendSubscriptionConfirmationEmail, sendEmail } from "./lib/send";
import type { SendEmailProps, SendEmailPropsWithReact, EmailResult, SendEmailUnifiedProps } from "./lib/send";
import { welcomeEmailTemplate, passwordResetTemplate } from "./lib/templates";

// Email templates (React components - may cause issues in server environment)
import { MyEmail } from "./emails/my-mail";
import { WelcomeEmail } from "./emails/welcome";
import { PasswordResetEmail } from "./emails/password-reset";
import { SubscriptionConfirmationEmail } from "./emails/subscription-confirmation";

export { 
  // RECOMMENDED: Unified email function - handles React internally
  sendEmail,
  // Legacy functions (use sendEmail instead)
  send,
  sendWithReact,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendSubscriptionConfirmationEmail,
  // HTML Templates (fallback for direct server use)
  welcomeEmailTemplate,
  passwordResetTemplate,
  // React Templates (low-level components, use sendEmail instead)
  MyEmail,
  WelcomeEmail,
  PasswordResetEmail,
  SubscriptionConfirmationEmail
};

export type { SendEmailProps, SendEmailPropsWithReact, EmailResult, SendEmailUnifiedProps };