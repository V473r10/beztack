import { send, sendWithReact } from "./lib/send";
import type { SendEmailProps, EmailResult } from "./lib/send";
import { welcomeEmailTemplate, passwordResetTemplate } from "./lib/templates";

// Email templates (React components - may cause issues in server environment)
import { MyEmail } from "./emails/my-mail";
import { WelcomeEmail } from "./emails/welcome";
import { PasswordResetEmail } from "./emails/password-reset";
import { SubscriptionConfirmationEmail } from "./emails/subscription-confirmation";

export { 
  send,
  sendWithReact,
  // HTML Templates (recommended for server use)
  welcomeEmailTemplate,
  passwordResetTemplate,
  // React Templates (may need special server setup)
  MyEmail,
  WelcomeEmail,
  PasswordResetEmail,
  SubscriptionConfirmationEmail
};

export type { SendEmailProps, EmailResult };