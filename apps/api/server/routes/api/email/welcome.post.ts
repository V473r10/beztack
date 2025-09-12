import { sendWelcomeEmail } from "@nvn/email";
import { defineEventHandler, readBody, createError } from "h3";

interface WelcomeEmailRequest {
    to: string;
    username?: string;
    loginUrl?: string;
}

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody<WelcomeEmailRequest>(event);
        
        if (!body.to) {
            throw createError({
                statusCode: 400,
                statusMessage: "Email recipient ('to') is required"
            });
        }

        const result = await sendWelcomeEmail({
            to: body.to,
            username: body.username,
            loginUrl: body.loginUrl,
        });

        if (!result.success) {
            throw createError({
                statusCode: 500,
                statusMessage: `Failed to send welcome email: ${result.error}`
            });
        }

        return {
            success: true,
            message: "Welcome email sent successfully with React template",
            emailId: result.data?.id,
        };
    } catch (error) {
        console.error("Error sending welcome email:", error);
        
        if (error && typeof error === 'object' && 'statusCode' in error) {
            throw error;
        }
        
        throw createError({
            statusCode: 500,
            statusMessage: "Internal server error while sending email"
        });
    }
});