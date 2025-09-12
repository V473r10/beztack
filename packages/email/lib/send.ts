import { Resend } from "resend";
import { render } from "@react-email/render";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailProps {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
}

interface SendEmailPropsWithReact {
    to: string | string[];
    subject: string;
    react: ReactElement;
    from?: string;
    replyTo?: string;
}

interface EmailResult {
    success: boolean;
    data?: any;
    error?: string;
}

export const send = async (props: SendEmailProps): Promise<EmailResult> => {
    try {
        // Validate required environment variables
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY environment variable is required');
        }

        if (!process.env.RESEND_FROM_EMAIL) {
            throw new Error('RESEND_FROM_EMAIL environment variable is required');
        }

        // Validate email addresses
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipients = Array.isArray(props.to) ? props.to : [props.to];
        
        for (const email of recipients) {
            if (!emailRegex.test(email)) {
                throw new Error(`Invalid email address: ${email}`);
            }
        }

        const fromName = process.env.RESEND_FROM_NAME || 'nvn';
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
            console.error('Resend API error:', error);
            return {
                success: false,
                error: error.message || 'Unknown email sending error'
            };
        }

        return {
            success: true,
            data
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Email sending error:', errorMessage);
        
        return {
            success: false,
            error: errorMessage
        };
    }
};

export const sendWithReact = async (props: SendEmailPropsWithReact): Promise<EmailResult> => {
    try {
        // Same validation as above
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY environment variable is required');
        }

        if (!process.env.RESEND_FROM_EMAIL) {
            throw new Error('RESEND_FROM_EMAIL environment variable is required');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipients = Array.isArray(props.to) ? props.to : [props.to];
        
        for (const email of recipients) {
            if (!emailRegex.test(email)) {
                throw new Error(`Invalid email address: ${email}`);
            }
        }

        const fromName = process.env.RESEND_FROM_NAME || 'nvn';
        const fromEmail = process.env.RESEND_FROM_EMAIL;
        const defaultFrom = `${fromName} <${fromEmail}>`;

        // Try react-email render first, fallback to react-dom/server
        let htmlContent: string;
        try {
            // First try the @react-email/render
            htmlContent = await render(props.react);
        } catch (reactEmailError) {
            console.warn('React Email render failed, trying react-dom/server:', reactEmailError);
            try {
                // Fallback to react-dom/server
                htmlContent = renderToStaticMarkup(props.react);
            } catch (reactDomError) {
                console.warn('React DOM render failed, throwing error to allow method-level fallback:', reactDomError);
                // Instead of generating error HTML, throw to allow method-level fallback  
                throw new Error(`React rendering failed: ${reactEmailError?.message || 'Unknown JSX error'}`);
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
            console.error('Resend API error:', error);
            return {
                success: false,
                error: error.message || 'Unknown email sending error'
            };
        }

        return {
            success: true,
            data
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Email sending error:', errorMessage);
        
        return {
            success: false,
            error: errorMessage
        };
    }
};

// Specific email methods
export const sendWelcomeEmail = async (props: { to: string; username?: string; loginUrl?: string }): Promise<EmailResult> => {
    try {
        const { WelcomeEmail } = await import("../emails/welcome");
        const React = await import("react");
        
        const result = await sendWithReact({
            to: props.to,
            subject: "¡Bienvenido a nvn!",
            react: React.createElement(WelcomeEmail, {
                username: props.username,
                loginUrl: props.loginUrl,
            }),
        });
        
        // Check if we got the error HTML instead of proper React rendering
        if (result.success && !result.error) {
            return result;
        } else {
            throw new Error(result.error || 'React email failed');
        }
    } catch (error) {
        console.warn('React welcome email failed, using HTML template fallback');
        // Fallback to HTML template if React fails
        const { welcomeEmailTemplate } = await import("../lib/templates");
        return send({
            to: props.to,
            subject: "¡Bienvenido a nvn!",
            html: welcomeEmailTemplate(props.username || 'Usuario', props.loginUrl),
        });
    }
};

export const sendPasswordResetEmail = async (props: { to: string; username?: string; resetUrl: string }): Promise<EmailResult> => {
    const { PasswordResetEmail } = await import("../emails/password-reset");
    const React = await import("react");
    
    return sendWithReact({
        to: props.to,
        subject: "Restablece tu contraseña - nvn",
        react: React.createElement(PasswordResetEmail, {
            username: props.username,
            resetUrl: props.resetUrl,
        }),
    });
};

export const sendSubscriptionConfirmationEmail = async (props: { 
    to: string; 
    username?: string; 
    planName: string;
    amount: string;
    billingPeriod: string;
    dashboardUrl?: string;
}): Promise<EmailResult> => {
    const { SubscriptionConfirmationEmail } = await import("../emails/subscription-confirmation");
    const React = await import("react");
    
    return sendWithReact({
        to: props.to,
        subject: `Confirmación de suscripción - Plan ${props.planName}`,
        react: React.createElement(SubscriptionConfirmationEmail, {
            username: props.username,
            planName: props.planName,
            amount: props.amount,
            billingPeriod: props.billingPeriod,
            dashboardUrl: props.dashboardUrl,
        }),
    });
};

export type { SendEmailProps, SendEmailPropsWithReact, EmailResult };
