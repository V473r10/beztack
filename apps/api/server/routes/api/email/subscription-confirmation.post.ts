import { sendEmail } from "@nvn/email";
import { createError, defineEventHandler, readBody } from "h3";

type SubscriptionConfirmationEmailRequest = {
  to: string;
  username?: string;
  planName: string;
  amount: string;
  billingPeriod: string;
  dashboardUrl?: string;
};

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<SubscriptionConfirmationEmailRequest>(event);

    if (!body.to) {
      throw createError({
        statusCode: 400,
        statusMessage: "Email recipient ('to') is required",
      });
    }

    if (!body.planName) {
      throw createError({
        statusCode: 400,
        statusMessage: "Plan name ('planName') is required",
      });
    }

    if (!body.amount) {
      throw createError({
        statusCode: 400,
        statusMessage: "Amount ('amount') is required",
      });
    }

    if (!body.billingPeriod) {
      throw createError({
        statusCode: 400,
        statusMessage: "Billing period ('billingPeriod') is required",
      });
    }

    const result = await sendEmail({
      type: "subscription-confirmation",
      to: body.to,
      data: {
        username: body.username,
        planName: body.planName,
        amount: body.amount,
        billingPeriod: body.billingPeriod,
        dashboardUrl: body.dashboardUrl,
      },
    });

    if (!result.success) {
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to send subscription confirmation email: ${result.error}`,
      });
    }

    return {
      success: true,
      message: "Subscription confirmation email sent successfully",
      emailId: result.data?.id,
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal server error while sending email",
    });
  }
});
