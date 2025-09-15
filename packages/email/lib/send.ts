import { render } from "@react-email/render";
import { renderToStaticMarkup } from "react-dom/server";
import { Resend } from "resend";
import type {
  EmailResult,
  EmailType,
  SendEmailProps,
  SendEmailPropsWithReact,
  SendEmailUnifiedProps,
} from "./interfaces";

export type {
  EmailResult,
  EmailType,
  SendEmailProps,
  SendEmailPropsWithReact,
  SendEmailUnifiedProps,
} from "./interfaces";

// Email validation regex at top level
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Email data types
type WelcomeEmailData = {
  username: string;
  loginUrl: string;
};

type PasswordResetEmailData = {
  username: string;
  resetUrl: string;
};

type SubscriptionConfirmationEmailData = {
  username: string;
  planName: string;
  amount: string;
  billingPeriod: string;
  dashboardUrl: string;
};

type CustomEmailData = {
  subject: string;
  message: string;
  username?: string;
};

type EmailTemplateData =
  | WelcomeEmailData
  | PasswordResetEmailData
  | SubscriptionConfirmationEmailData
  | CustomEmailData;

// Type guards for EmailTemplateData
function isWelcomeEmailData(data: EmailTemplateData): data is WelcomeEmailData {
  return "loginUrl" in data;
}

function isPasswordResetEmailData(
  data: EmailTemplateData
): data is PasswordResetEmailData {
  return "resetUrl" in data;
}

function isSubscriptionConfirmationEmailData(
  data: EmailTemplateData
): data is SubscriptionConfirmationEmailData {
  return "planName" in data && "amount" in data;
}

// Helper functions for validating specific email types
function validateWelcomeData(data: Record<string, unknown>): WelcomeEmailData {
  const username = data.username;
  const loginUrl = data.loginUrl;
  if (!username) {
    throw new Error("Welcome email requires username");
  }
  if (!loginUrl) {
    throw new Error("Welcome email requires loginUrl");
  }
  return {
    username: String(username),
    loginUrl: String(loginUrl),
  };
}

function validatePasswordResetData(
  data: Record<string, unknown>
): PasswordResetEmailData {
  const username = data.username;
  const resetUrl = data.resetUrl;
  if (!username) {
    throw new Error("Password reset email requires username");
  }
  if (!resetUrl) {
    throw new Error("Password reset email requires resetUrl");
  }
  return {
    username: String(username),
    resetUrl: String(resetUrl),
  };
}

function validateSubscriptionData(
  data: Record<string, unknown>
): SubscriptionConfirmationEmailData {
  const { username, planName, amount, billingPeriod, dashboardUrl } = data;
  if (!username) {
    throw new Error("Subscription email requires username");
  }
  if (!planName) {
    throw new Error("Subscription email requires planName");
  }
  if (!amount) {
    throw new Error("Subscription email requires amount");
  }
  if (!billingPeriod) {
    throw new Error("Subscription email requires billingPeriod");
  }
  if (!dashboardUrl) {
    throw new Error("Subscription email requires dashboardUrl");
  }
  return {
    username: String(username),
    planName: String(planName),
    amount: String(amount),
    billingPeriod: String(billingPeriod),
    dashboardUrl: String(dashboardUrl),
  };
}

// Helper function to ensure required properties are present
function validateEmailData(
  type: EmailType,
  data: Record<string, unknown>
): EmailTemplateData {
  // biome-ignore lint/nursery/noUnnecessaryConditions: false positive
  switch (type) {
    case "welcome":
      return validateWelcomeData(data);
    case "password-reset":
      return validatePasswordResetData(data);
    case "subscription-confirmation":
      return validateSubscriptionData(data);
    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

export const send = async (props: SendEmailProps): Promise<EmailResult> => {
  try {
    validateEnvironment();
    validateEmailAddresses(props.to);

    const fromName = process.env.RESEND_FROM_NAME || "nvn";
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const defaultFrom = `${fromName} <${fromEmail}>`;

    const { data, error } = await resend.emails.send({
      from: props.from || defaultFrom,
      to: props.to,
      subject: props.subject,
      replyTo: props.replyTo,
      html: props.html,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Unknown email sending error",
      };
    }

    return {
      success: true,
      data: data
        ? { ...data, id: data.id, message: "Email sent successfully" }
        : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Helper function to validate environment variables
function validateEnvironment(): void {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is required");
  }
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL environment variable is required");
  }
}

// Helper function to validate email addresses
function validateEmailAddresses(to: string | string[]): void {
  const recipients = Array.isArray(to) ? to : [to];
  for (const email of recipients) {
    if (!EMAIL_REGEX.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
  }
}

// Helper function to render React content to HTML
async function renderReactToHtml(
  reactElement: React.ReactElement
): Promise<string> {
  try {
    return await render(reactElement);
  } catch (reactEmailError: unknown) {
    try {
      return renderToStaticMarkup(reactElement);
    } catch (_reactDomError: unknown) {
      const msg =
        reactEmailError instanceof Error
          ? reactEmailError.message
          : "Unknown JSX error";
      throw new Error(`React rendering failed: ${msg}`);
    }
  }
}

export const sendWithReact = async (
  props: SendEmailPropsWithReact
): Promise<EmailResult> => {
  try {
    validateEnvironment();
    validateEmailAddresses(props.to);

    const fromName = process.env.RESEND_FROM_NAME || "nvn";
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const defaultFrom = `${fromName} <${fromEmail}>`;

    const htmlContent = await renderReactToHtml(props.react);

    const { data, error } = await resend.emails.send({
      from: props.from || defaultFrom,
      to: props.to,
      subject: props.subject,
      replyTo: props.replyTo,
      html: htmlContent,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Unknown email sending error",
      };
    }

    return {
      success: true,
      data: data
        ? { ...data, id: data.id, message: "Email sent successfully" }
        : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      error: errorMessage,
    };
  }
};

export const sendEmail = async (
  props: SendEmailUnifiedProps
): Promise<EmailResult> => {
  try {
    // Validate and normalize the email data
    const validatedData = validateEmailData(props.type, props.data);

    // Try React templates first
    const reactTemplate = await getReactTemplate(props.type, validatedData);
    const result = await sendWithReact({
      to: props.to,
      subject: getEmailSubject(props.type, validatedData),
      react: reactTemplate,
    });

    if (result.success && !result.error) {
      return result;
    }
    throw new Error(result.error || "React email failed");
  } catch (_error) {
    // Fallback to HTML template
    try {
      const validatedData = validateEmailData(props.type, props.data);
      const htmlTemplate = await getHTMLTemplate(props.type, validatedData);
      return send({
        to: props.to,
        subject: getEmailSubject(props.type, validatedData),
        html: htmlTemplate,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Email sending failed",
      };
    }
  }
};

// Internal helper functions
async function getReactTemplate(type: EmailType, data: EmailTemplateData) {
  const React = await import("react");

  // biome-ignore lint/nursery/noUnnecessaryConditions: false positive
  switch (type) {
    case "welcome": {
      if (!isWelcomeEmailData(data)) {
        throw new Error("Invalid data for welcome email template");
      }
      const { WelcomeEmail } = await import("../emails/welcome");
      return React.createElement(WelcomeEmail, {
        username: data.username,
        loginUrl: data.loginUrl,
      });
    }
    case "password-reset": {
      if (!isPasswordResetEmailData(data)) {
        throw new Error("Invalid data for password reset email template");
      }
      const { PasswordResetEmail } = await import("../emails/password-reset");
      return React.createElement(PasswordResetEmail, {
        username: data.username,
        resetUrl: data.resetUrl,
      });
    }
    case "subscription-confirmation": {
      if (!isSubscriptionConfirmationEmailData(data)) {
        throw new Error(
          "Invalid data for subscription confirmation email template"
        );
      }
      const { SubscriptionConfirmationEmail } = await import(
        "../emails/subscription-confirmation"
      );
      return React.createElement(SubscriptionConfirmationEmail, {
        username: data.username,
        planName: data.planName,
        amount: data.amount,
        billingPeriod: data.billingPeriod,
        dashboardUrl: data.dashboardUrl,
      });
    }
    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

async function getHTMLTemplate(
  type: EmailType,
  data: EmailTemplateData
): Promise<string> {
  // biome-ignore lint/nursery/noUnnecessaryConditions: false positive
  switch (type) {
    case "welcome": {
      if (!isWelcomeEmailData(data)) {
        throw new Error("Invalid data for welcome email template");
      }
      const { welcomeEmailTemplate } = await import("../lib/templates");
      return welcomeEmailTemplate(data.username, data.loginUrl);
    }
    case "password-reset": {
      if (!isPasswordResetEmailData(data)) {
        throw new Error("Invalid data for password reset email template");
      }
      const { passwordResetTemplate } = await import("../lib/templates");
      return passwordResetTemplate(data.username);
    }
    case "subscription-confirmation": {
      if (!isSubscriptionConfirmationEmailData(data)) {
        throw new Error(
          "Invalid data for subscription confirmation email template"
        );
      }
      // For now, use welcome template as placeholder
      const { welcomeEmailTemplate: welcomeTemplate } = await import(
        "../lib/templates"
      );
      return welcomeTemplate(data.username);
    }
    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

function getEmailSubject(type: EmailType, data: EmailTemplateData): string {
  // biome-ignore lint/nursery/noUnnecessaryConditions: false positive
  switch (type) {
    case "welcome":
      return "¡Bienvenido a nvn!";
    case "password-reset":
      return "Restablece tu contraseña - nvn";
    case "subscription-confirmation": {
      if (isSubscriptionConfirmationEmailData(data)) {
        return `Confirmación de suscripción - Plan ${data.planName}`;
      }
      return "Confirmación de suscripción - Plan Premium";
    }
    default:
      return "Email from nvn";
  }
}
