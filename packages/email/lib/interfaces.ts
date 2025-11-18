import type { ReactElement } from "react";

// Main unified email function - API should use this
export type EmailType =
  | "welcome"
  | "password-reset"
  | "subscription-confirmation"
  | "organization-invitation";

export type SendEmailProps = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailPropsWithReact = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  from?: string;
  replyTo?: string;
};

export type EmailResult = {
  success: boolean;
  data?: {
    id?: string;
    message?: string;
    [key: string]: unknown;
  };
  error?: string;
};

export type SendEmailUnifiedProps = {
  type: EmailType;
  to: string;
  data: {
    username?: string;
    loginUrl?: string;
    resetUrl?: string;
    planName?: string;
    amount?: string;
    billingPeriod?: string;
    dashboardUrl?: string;
    invitedByUsername?: string;
    invitedByEmail?: string;
    organizationName?: string;
    invitationUrl?: string;
  };
};
