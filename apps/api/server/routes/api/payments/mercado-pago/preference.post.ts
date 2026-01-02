import { defineEventHandler, readBody } from "h3";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { env } from "@/env";

const client = new MercadoPagoConfig({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
});

const isLocalhost = env.BETTER_AUTH_URL.includes("localhost");

export default defineEventHandler(async (event) => {
  try {
    const data = await readBody(event);

    if (!(data?.unit_price && data?.quantity && data?.title)) {
      throw new Error(
        "Missing required fields: unit_price, quantity, or title"
      );
    }

    const preference = new Preference(client);
    const response = await preference.create({
      body: {
        items: [
          {
            title: data.title,
            quantity: data.quantity,
            unit_price: data.unit_price,
          },
        ],
        ...(isLocalhost
          ? {}
          : {
              back_urls: {
                success: `${env.BETTER_AUTH_URL}/payments/success`,
                pending: `${env.BETTER_AUTH_URL}/payments/pending`,
                failure: `${env.BETTER_AUTH_URL}/payments/failure`,
              },
              auto_return: "approved",
              notification_url: `${env.BETTER_AUTH_URL}/api/payments/mercado-pago/webhook`,
            }),
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12,
        },
      },
    });

    return response;
  } catch (error) {
    return {
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
