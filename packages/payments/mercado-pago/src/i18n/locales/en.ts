import type { TranslationKeys } from "../types.js";

export const en: TranslationKeys = {
  paymentStatus: {
    pending: "Pending",
    approved: "Approved",
    authorized: "Authorized",
    in_process: "In process",
    in_mediation: "In mediation",
    rejected: "Rejected",
    cancelled: "Cancelled",
    refunded: "Refunded",
    charged_back: "Charged back",
  },

  subscriptionStatus: {
    pending: "Pending",
    authorized: "Authorized",
    active: "Active",
    paused: "Paused",
    cancelled: "Cancelled",
  },

  planStatus: {
    active: "Active",
    inactive: "Inactive",
  },

  frequency: {
    day: "day",
    days: "days",
    month: "month",
    months: "months",
    every: "every",
    everyN: "every {n} {unit}",
  },

  components: {
    subscription: "Subscription",
    nextPayment: "Next payment",
    charges: "Charges",
    total: "Total",
    createdAt: "Created",

    pause: "Pause",
    pausing: "Pausing...",
    resume: "Resume",
    resuming: "Resuming...",
    cancel: "Cancel",
    cancelling: "Cancelling...",
    cancelConfirm:
      "Are you sure you want to cancel this subscription? This action cannot be undone.",

    noSubscriptions: "No subscriptions",
    loadingSubscriptions: "Loading subscriptions...",

    billingHistory: "Billing History",
    noInvoices: "No invoices to show",
    loadingHistory: "Loading history...",
    attempt: "Attempt",
  },

  common: {
    loading: "Loading...",
    error: "Error",
    retry: "Retry",
    close: "Close",
    confirm: "Confirm",
    save: "Save",
  },
};

// en-US is the same as en for now
export const enUS: TranslationKeys = {
  ...en,
};
