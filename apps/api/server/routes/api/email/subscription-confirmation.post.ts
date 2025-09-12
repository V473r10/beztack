import { SubscriptionConfirmationEmail, send } from "@nvn/email";
import { defineEventHandler, readBody, createError } from "h3";
import * as React from "react";

interface SubscriptionConfirmationEmailRequest {
    to: string;
    username?: string;
    planName?: string;
    amount?: string;
    billingPeriod?: string;
    dashboardUrl?: string;
}

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody<SubscriptionConfirmationEmailRequest>(event);
        
        if (!body.to) {
            throw createError({
                statusCode: 400,
                statusMessage: "Email recipient ('to') is required"
            });
        }

        const result = await send({
            to: body.to,
            subject: `Confirmación de Suscripción - ${body.planName || 'Plan'} nvn`,
            react: React.createElement(SubscriptionConfirmationEmail, {
                username: body.username,
                planName: body.planName,
                amount: body.amount,
                billingPeriod: body.billingPeriod,
                dashboardUrl: body.dashboardUrl,
            }),
        });

        if (!result.success) {
            throw createError({
                statusCode: 500,
                statusMessage: `Failed to send subscription confirmation email: ${result.error}`
            });
        }

        return {
            success: true,
            message: "Subscription confirmation email sent successfully",
            emailId: result.data?.id,
        };
    } catch (error) {
        console.error("Error sending subscription confirmation email:", error);
        
        if (error && typeof error === 'object' && 'statusCode' in error) {
            throw error;
        }
        
        throw createError({
            statusCode: 500,
            statusMessage: "Internal server error while sending email"
        });
    }
});