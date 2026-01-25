import { Activity, CheckCircle2, Radio, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type ConnectionStatus,
  type PaymentEvent,
  usePaymentEvents,
} from "@/hooks/use-payment-events";

type PaymentEventsMonitorProps = {
  /** Filter events for a specific user ID */
  userId?: string;
  /** Show toast notifications (default: true) */
  showToasts?: boolean;
  /** Custom event handler */
  onEvent?: (event: PaymentEvent) => void;
  /** Listen to ALL events - only for demos/admin (default: false) */
  listenToAll?: boolean;
};

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  connecting: {
    label: "Conectando...",
    color: "bg-yellow-500",
    icon: <Activity className="h-3 w-3 animate-pulse" />,
  },
  connected: {
    label: "Conectado",
    color: "bg-green-500",
    icon: <Radio className="h-3 w-3 animate-pulse" />,
  },
  disconnected: {
    label: "Desconectado",
    color: "bg-gray-500",
    icon: <XCircle className="h-3 w-3" />,
  },
  error: {
    label: "Error",
    color: "bg-red-500",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  "payment.approved": "bg-green-500/20 text-green-700 border-green-500/50",
  "payment.rejected": "bg-red-500/20 text-red-700 border-red-500/50",
  "payment.pending": "bg-yellow-500/20 text-yellow-700 border-yellow-500/50",
  "payment.refunded": "bg-blue-500/20 text-blue-700 border-blue-500/50",
  "subscription.authorized":
    "bg-green-500/20 text-green-700 border-green-500/50",
  "subscription.active": "bg-green-500/20 text-green-700 border-green-500/50",
  "subscription.paused":
    "bg-orange-500/20 text-orange-700 border-orange-500/50",
  "subscription.cancelled": "bg-red-500/20 text-red-700 border-red-500/50",
  "invoice.processed": "bg-green-500/20 text-green-700 border-green-500/50",
  "invoice.failed": "bg-red-500/20 text-red-700 border-red-500/50",
  "chargeback.created": "bg-red-500/20 text-red-700 border-red-500/50",
};

function formatEventTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAmount(
  amount: string | null | undefined,
  currency: string | null | undefined
): string {
  if (!amount) {
    return "";
  }
  const num = Number.parseFloat(amount);
  if (Number.isNaN(num)) {
    return "";
  }
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: currency || "UYU",
  }).format(num);
}

export function PaymentEventsMonitor({
  userId,
  showToasts = true,
  onEvent,
  listenToAll = false,
}: PaymentEventsMonitorProps) {
  const { status, events, isConnected } = usePaymentEvents({
    userId,
    showToasts,
    onEvent,
    listenToAll,
  });

  const statusConfig = STATUS_CONFIG[status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            Eventos en Tiempo Real
          </CardTitle>
          <Badge
            className={`flex items-center gap-1.5 ${statusConfig.color} text-white`}
            variant="outline"
          >
            {statusConfig.icon}
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {isConnected ? (
              <>
                <Radio className="mx-auto mb-2 h-8 w-8 animate-pulse opacity-50" />
                <p className="text-sm">Esperando eventos...</p>
                <p className="mt-1 text-xs">
                  Los pagos y suscripciones aparecerán aquí en tiempo real
                </p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">Sin conexión</p>
                <p className="mt-1 text-xs">Reconectando automáticamente...</p>
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {events.map((event, index) => (
                <div
                  className={`rounded-lg border p-3 ${EVENT_TYPE_COLORS[event.type] || "bg-gray-100"}`}
                  key={`${event.timestamp}-${index}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium text-sm">
                          {event.type.replace(".", " ").toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs opacity-80">
                        {event.data.description ||
                          event.data.reason ||
                          event.data.id}
                        {event.data.amount && (
                          <span className="ml-2 font-medium">
                            {formatAmount(
                              event.data.amount,
                              event.data.currency
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs opacity-60">
                      {formatEventTime(event.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
