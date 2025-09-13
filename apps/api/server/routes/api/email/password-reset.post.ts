import { sendEmail } from "@nvn/email";
import { defineEventHandler, readBody, createError } from "h3";

interface PasswordResetEmailRequest {
    to: string;
    username?: string;
    resetUrl: string;
}

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody<PasswordResetEmailRequest>(event);
        
        if (!body.to) {
            throw createError({
                statusCode: 400,
                statusMessage: "Email recipient ('to') is required"
            });
        }

        if (!body.resetUrl) {
            throw createError({
                statusCode: 400,
                statusMessage: "Reset URL ('resetUrl') is required"
            });
        }

        const result = await sendEmail({
            type: 'password-reset',
            to: body.to,
            data: {
                username: body.username,
                resetUrl: body.resetUrl,
            },
        });

        if (!result.success) {
            throw createError({
                statusCode: 500,
                statusMessage: `Failed to send password reset email: ${result.error}`
            });
        }

        return {
            success: true,
            message: "Password reset email sent successfully",
            emailId: result.data?.id,
        };
    } catch (error) {
        console.error("Error sending password reset email:", error);
        
        if (error && typeof error === 'object' && 'statusCode' in error) {
            throw error;
        }
        
        throw createError({
            statusCode: 500,
            statusMessage: "Internal server error while sending email"
        });
    }
});