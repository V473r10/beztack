import { createError, defineEventHandler, readBody } from "h3";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { env } from "@/env";

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

    const payment = new Payment(client);
    const response = await payment.create({
      body: {
        token: body.token,
        issuer_id: body.issuer_id,
        payment_method_id: body.payment_method_id,
        transaction_amount: body.transaction_amount,
        installments: body.installments,
        description: body.description,
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

    throw createError({
      statusCode: 500,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error processing payment",
    });
  }
});
