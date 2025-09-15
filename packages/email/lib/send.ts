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

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

export const send = async (props: SendEmailProps): Promise<EmailResult> => {
  try {
    // Validate required environment variables
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      throw new Error("RESEND_FROM_EMAIL environment variable is required");
    }

    // Validate email addresses
    const recipients = Array.isArray(props.to) ? props.to : [props.to];

    for (const email of recipients) {
      if (!EMAIL_REGEX.test(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }

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
      data,
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

export const sendWithReact = async (
  props: SendEmailPropsWithReact
): Promise<EmailResult> => {
  try {
    // Same validation as above
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      throw new Error("RESEND_FROM_EMAIL environment variable is required");
    }

    // Validate email addresses using top-level regex
    const recipients = Array.isArray(props.to) ? props.to : [props.to];

    for (const email of recipients) {
      if (!EMAIL_REGEX.test(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }

    const fromName = process.env.RESEND_FROM_NAME || "nvn";
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const defaultFrom = `${fromName} <${fromEmail}>`;

    // Try react-email render first, fallback to react-dom/server
    let htmlContent: string;
    try {
      // First try the @react-email/render
      htmlContent = await render(props.react);
    } catch (reactEmailError: unknown) {
      try {
        // Fallback to react-dom/server
        htmlContent = renderToStaticMarkup(props.react);
      } catch (_reactDomError: unknown) {
        // Instead of generating error HTML, throw to allow method-level fallback
        const msg =
          reactEmailError instanceof Error
            ? reactEmailError.message
            : "Unknown JSX error";
        throw new Error(`React rendering failed: ${msg}`);
      }
    }

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
      data,
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
    // Try React templates first
    const reactTemplate = await getReactTemplate(props.type, props.data);
    const result = await sendWithReact({
      to: props.to,
      subject: getEmailSubject(props.type, props.data),
      react: reactTemplate,
    });

    if (result.success && !result.error) {
      return result;
    }
    throw new Error(result.error || "React email failed");
  } catch (_error) {
    // Fallback to HTML template
    const htmlTemplate = await getHTMLTemplate(props.type, props.data);
    return send({
      to: props.to,
      subject: getEmailSubject(props.type, props.data),
      html: htmlTemplate,
    });
  }
};

// Internal helper functions
async function getReactTemplate(type: EmailType, data: EmailTemplateData) {
  const React = await import("react");

  switch (type) {
    case "welcome": {
      const { WelcomeEmail } = await import("../emails/welcome");
      return React.createElement(WelcomeEmail, {
        username: data.username,
        loginUrl: data.loginUrl,
      });
    }
    case "password-reset": {
      const { PasswordResetEmail } = await import("../emails/password-reset");
      return React.createElement(PasswordResetEmail, {
        username: data.username,
        resetUrl: data.resetUrl,
      });
    }
    case "subscription-confirmation": {
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
  switch (type) {
    case "welcome": {
      const { welcomeEmailTemplate } = await import("../lib/templates");
      return welcomeEmailTemplate(data.username || "Usuario", data.loginUrl);
    }
    case "password-reset": {
      const { passwordResetTemplate } = await import("../lib/templates");
      return passwordResetTemplate(data.username || "Usuario");
    }
    case "subscription-confirmation": {
      // For now, use welcome template as placeholder
      const { welcomeEmailTemplate: welcomeTemplate } = await import(
        "../lib/templates"
      );
      return welcomeTemplate(data.username || "Usuario");
    }
    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

function getEmailSubject(type: EmailType, data: EmailTemplateData): string {
  switch (type) {
    case "welcome":
      return "¡Bienvenido a nvn!";
    case "password-reset":
      return "Restablece tu contraseña - nvn";
    case "subscription-confirmation":
      return `Confirmación de suscripción - Plan ${data.planName || "Premium"}`;
    default:
      return "Email from nvn";
  }
}

export type {
  SendEmailProps,
  SendEmailPropsWithReact,
  EmailResult,
  SendEmailUnifiedProps,
};
