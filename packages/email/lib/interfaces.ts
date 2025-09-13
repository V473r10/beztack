import type { ReactElement } from "react";

// Main unified email function - API should use this
export type EmailType = 'welcome' | 'password-reset' | 'subscription-confirmation';

export interface SendEmailProps {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
}

export interface SendEmailPropsWithReact {
    to: string | string[];
    subject: string;
    react: ReactElement;
    from?: string;
    replyTo?: string;
}

export interface EmailResult {
    success: boolean;
    data?: any;
    error?: string;
}

export interface SendEmailUnifiedProps {
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
    };
}
