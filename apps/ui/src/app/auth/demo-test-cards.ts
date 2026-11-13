import type { env } from "@/env";

export type TestCard = {
  id: string;
  brand: string;
  outcome: "approved" | "declined";
  number: string;
  /** Left out when the sandbox accepts any future date. */
  expiry?: string;
  /** Left out when the sandbox accepts any security code. */
  cvc?: string;
  /** Cardholder name that makes the sandbox approve or reject the payment. */
  holder?: string;
};

type PaymentProvider = (typeof env)["VITE_PAYMENT_PROVIDER"];

/**
 * Public sandbox test cards of each payment provider (not secrets). Source:
 * Polar sandbox (Stripe test cards) and the Mercado Pago developer docs.
 */
export const DEMO_TEST_CARDS: Record<PaymentProvider, TestCard[]> = {
  polar: [
    { id: "visa-approved", brand: "Visa", outcome: "approved", number: "4242 4242 4242 4242" },
    { id: "visa-declined", brand: "Visa", outcome: "declined", number: "4000 0000 0000 0002" },
  ],
  mercadopago: [
    {
      id: "mastercard-approved",
      brand: "Mastercard",
      outcome: "approved",
      number: "5031 7557 3453 0604",
      expiry: "11/30",
      cvc: "123",
      holder: "APRO",
    },
    {
      id: "visa-approved",
      brand: "Visa",
      outcome: "approved",
      number: "4509 9535 6623 3704",
      expiry: "11/30",
      cvc: "123",
      holder: "APRO",
    },
    {
      id: "visa-declined",
      brand: "Visa",
      outcome: "declined",
      number: "4509 9535 6623 3704",
      expiry: "11/30",
      cvc: "123",
      holder: "OTHE",
    },
  ],
};

export const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  polar: "Polar",
  mercadopago: "Mercado Pago",
};
