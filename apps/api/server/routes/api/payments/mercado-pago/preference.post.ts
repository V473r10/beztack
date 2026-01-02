import { defineEventHandler } from "h3";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { env } from "@/env";

const client = new MercadoPagoConfig({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
});

export default defineEventHandler(async (event) => {
  try {
    const data = event.body ? JSON.parse(event.body as string) : {};

    if (!data || data.unit_price || !data.quantity || !data.title) {
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
        back_urls: {
          success: "https://yourdomain.com/success",
          pending: "https://yourdomain.com/pending",
          failure: "https://yourdomain.com/failure",
        },
        auto_return: "approved",
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12,
        },
        notification_url: "https://yourdomain.com/notifications",
      },
    });

    return response;
  } catch (error) {
    console.error("Error parsing request body:", error);
  }
});
