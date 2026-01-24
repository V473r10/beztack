import { createError, defineEventHandler, readBody } from "h3";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { env } from "@/env";
import { auth } from "@/server/utils/auth";

const client = new MercadoPagoConfig({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
});

type PaymentRequestBody = {
  token: string;
  issuer_id: number;
  payment_method_id: string;
  transaction_amount: number;
  installments: number;
  description: string;
  payer: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  external_reference?: string;
};

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<PaymentRequestBody>(event);

    if (!(body.token && body.payment_method_id && body.transaction_amount)) {
      throw createError({
        statusCode: 400,
        message:
          "Missing required fields: token, payment_method_id, or transaction_amount",
      });
    }

    // Get authenticated user if available
    const session = await auth.api.getSession({ headers: event.headers });
    const userId = session?.user?.id;

    const payment = new Payment(client);
    const response = await payment.create({
      body: {
        token: body.token,
        issuer_id: body.issuer_id,
        payment_method_id: body.payment_method_id,
        transaction_amount: body.transaction_amount,
        installments: body.installments,
        description: body.description,
        // Set external_reference to userId for webhook linking
        external_reference: userId ?? body.external_reference,
        payer: {
          email: body.payer.email,
          identification: body.payer.identification,
        },
      },
    });

    return {
      id: response.id,
      status: response.status,
      status_detail: response.status_detail,
      date_approved: response.date_approved,
      payment_method_id: response.payment_method_id,
      payment_type_id: response.payment_type_id,
    };
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }

    // biome-ignore lint/suspicious/noConsole: Needed for debugging MP errors
    console.error("Mercado Pago payment error:", error);

    // Handle Mercado Pago API errors
    if (error && typeof error === "object" && "cause" in error) {
      const mpError = error as {
        cause?: { code: string; description: string }[];
      };
      const causes = mpError.cause?.map((c) => c.description).join(", ");
      throw createError({
        statusCode: 400,
        message: causes || "Mercado Pago API error",
      });
    }

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error processing payment",
    });
  }
});
