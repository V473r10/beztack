import { createMercadoPagoClient } from "@beztack/mercadopago/server";
import { createError, defineEventHandler, readBody } from "h3";
import { env } from "@/env";
import { auth } from "@/server/utils/auth";

const mp = createMercadoPagoClient({
  accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
  integratorId: env.MERCADO_PAGO_INTEGRATOR_ID,
});

const isLocalhost = env.APP_URL.includes("localhost");

export default defineEventHandler(async (event) => {
  const data = await readBody(event);

  if (!(data?.unit_price && data?.quantity && data?.title)) {
    throw createError({
      statusCode: 400,
      message: "Missing required fields: unit_price, quantity, or title",
    });
  }

  // Get authenticated user if available
  const session = await auth.api.getSession({ headers: event.headers });
  const userId = session?.user?.id;

  const response = await mp.checkout.createPreference({
    payment_methods: {
      excluded_payment_methods: [{ id: "visa" }],
      installments: 6,
    },
    items: [
      {
        id: data.id,
        title: data.title,
        quantity: data.quantity,
        unit_price: data.unit_price,
      },
    ],
    // external_reference: userId ?? data.external_reference,
    external_reference: "mpago@facundovalerio.com",
    ...(isLocalhost
      ? {}
      : {
          back_urls: {
            success: `${env.APP_URL}/payments/success`,
            pending: `${env.APP_URL}/payments/pending`,
            failure: `${env.APP_URL}/payments/failure`,
          },
          auto_return: "approved",
          notification_url: `${env.APP_URL}/api/payments/mercado-pago/webhook`,
        }),
  });

  return response;
});
