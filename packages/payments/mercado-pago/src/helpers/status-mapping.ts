import type { SubscriptionStatus } from "@beztack/payments";

export function mapMPStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "authorized":
      return "active";
    case "pending":
      return "pending";
    case "paused":
      return "paused";
    case "cancelled":
      return "canceled";
    default:
      return "canceled";
  }
}
