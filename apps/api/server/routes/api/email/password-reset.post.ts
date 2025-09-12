import { passwordResetTemplate, send } from "@nvn/email";
import { defineEventHandler, readBody, createError } from "h3";

interface PasswordResetEmailRequest {
    to: string;
    username?: string;
    resetUrl?: string;
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

        const result = await send({
            to: body.to,
            subject: "Restablecimiento de Contraseña - nvn",
            html: passwordResetTemplate(body.username || 'Usuario'),
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