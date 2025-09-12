import { Resend } from "resend";
import type { ReactElement } from "react";

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

        const { data, error } = await resend.emails.send({
            from: props.from || defaultFrom,
            to: props.to,
            subject: props.subject,
            replyTo: props.replyTo,
            react: props.react as any,
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

export type { SendEmailProps, EmailResult };
