import {
  CardForm,
  CheckoutButton,
  formatFrequency,
  formatPlanPrice,
  PaymentBrick,
  type Plan,
} from "@beztack/mercadopago/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Code2,
  CreditCard,
  ExternalLink,
  RefreshCcw,
  Server,
  Wallet,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import {
  PaymentEventsMonitor,
  PlanList,
  SubscriptionForm,
} from "@/components/payments/mercado-pago";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PaymentResult = {
  id: number;
  status: string;
  timestamp: Date;
};

type SubscriptionResult = {
  id: string;
  initPoint: string;
  timestamp: Date;
};

const DEMO_AMOUNT = 100;

export default function MercadoPagoDemo() {
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(
    null
  );
  const [subscriptionResult, setSubscriptionResult] =
    useState<SubscriptionResult | null>(null);
  const [customAmount, setCustomAmount] = useState(DEMO_AMOUNT);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const handlePaymentSuccess = (paymentId: number, status: string) => {
    setPaymentResult({ id: paymentId, status, timestamp: new Date() });
  };

  const handlePaymentError = (error: Error) => {
    // biome-ignore lint/suspicious/noConsole: Demo logging
    console.error("Payment error:", error);
  };

  const handleSubscriptionSuccess = (
    subscriptionId: string,
    initPoint: string
  ) => {
    setSubscriptionResult({
      id: subscriptionId,
      initPoint,
      timestamp: new Date(),
    });
  };

  return (
    <div className="container mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <img
            alt="Mercado Pago"
            className="h-8"
            height={32}
            src="https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/6.6.92/mercadopago/logo__large@2x.png"
            width={150}
          />
          <h1 className="font-bold text-4xl">Integration Demo</h1>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          Esta demo interactiva muestra los tres tipos de integración de Mercado
          Pago disponibles en Beztack: <strong>Checkout Pro</strong>,{" "}
          <strong>Payment Bricks</strong> y <strong>Checkout API</strong>. Cada
          uno tiene diferentes casos de uso, niveles de personalización y
          requisitos de implementación.
        </p>
      </div>

      {/* Quick Reference */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Checkout Pro</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Redirige al usuario a Mercado Pago. Mínimo código, máxima
              conversión.
            </p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">Baja complejidad</Badge>
              <Badge variant="secondary">UX externa</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/50 bg-purple-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-lg">Payment Bricks</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Componentes embebidos con UI pre-construida. Balance entre control
              y facilidad.
            </p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">Media complejidad</Badge>
              <Badge variant="secondary">UX en sitio</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-lg">Checkout API</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Control total del formulario de pago. Máxima personalización.
            </p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">Alta complejidad</Badge>
              <Badge variant="secondary">UI customizable</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Main Demo Tabs */}
      <Tabs className="w-full" defaultValue="payments">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="payments">
            <Wallet className="mr-2 h-4 w-4" />
            Pagos Únicos
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Suscripciones
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="mr-2 h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="reference">
            <Server className="mr-2 h-4 w-4" />
            Referencia API
          </TabsTrigger>
        </TabsList>

        {/* PAYMENTS TAB */}
        <TabsContent className="space-y-6" value="payments">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Interactive Demo */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración del Pago</CardTitle>
                  <CardDescription>
                    Configura el monto y prueba cada tipo de checkout
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Monto (UYU)</Label>
                    <Input
                      id="amount"
                      min={1}
                      onChange={(e) =>
                        setCustomAmount(Number.parseInt(e.target.value, 10))
                      }
                      type="number"
                      value={customAmount}
                    />
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="pro">
                <TabsList className="w-full">
                  <TabsTrigger className="flex-1" value="pro">
                    Pro
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="bricks">
                    Bricks
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="api">
                    API
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pro">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ExternalLink className="h-5 w-5 text-blue-500" />
                        Checkout Pro
                      </CardTitle>
                      <CardDescription>
                        El usuario es redirigido a Mercado Pago para completar
                        el pago
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <CheckoutButton
                        description="Dispositivo de tienda móvil de comercio electrónico"
                        pictureUrl="https://placehold.co/600x400"
                        quantity={1}
                        title="Producto de prueba"
                        unitPrice={customAmount}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="bricks">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-purple-500" />
                        Payment Brick
                      </CardTitle>
                      <CardDescription>
                        Formulario de pago embebido con UI de Mercado Pago
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PaymentBrick
                        amount={customAmount}
                        description="Pago con Payment Brick"
                        onError={handlePaymentError}
                        onSuccess={handlePaymentSuccess}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="api">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Code2 className="h-5 w-5 text-orange-500" />
                        Checkout API (CardPayment)
                      </CardTitle>
                      <CardDescription>
                        Formulario de tarjeta con tokenización directa
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <CardForm
                        amount={customAmount}
                        description="Pago con Checkout API"
                        onError={handlePaymentError}
                        onSuccess={handlePaymentSuccess}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Payment Result */}
              {paymentResult && (
                <Alert
                  variant={
                    paymentResult.status === "approved"
                      ? "default"
                      : "destructive"
                  }
                >
                  {paymentResult.status === "approved" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>Resultado del Pago</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1 font-mono text-sm">
                      <p>ID: {paymentResult.id}</p>
                      <p>Status: {paymentResult.status}</p>
                      <p>Timestamp: {paymentResult.timestamp.toISOString()}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Right: Documentation */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Flujo de Datos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge>1</Badge>
                      <span>Frontend envía datos al backend</span>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="mb-2 font-medium text-sm">
                        Request (Bricks/API):
                      </p>
                      <ScrollArea className="h-32">
                        <pre className="font-mono text-xs">
                          {JSON.stringify(
                            {
                              token: "card_token_xxx",
                              issuer_id: 1234,
                              payment_method_id: "visa",
                              transaction_amount: customAmount,
                              installments: 1,
                              description: "Descripción del producto",
                              payer: {
                                email: "user@email.com",
                                identification: {
                                  type: "CI",
                                  number: "12345678",
                                },
                              },
                            },
                            null,
                            2
                          )}
                        </pre>
                      </ScrollArea>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Badge>2</Badge>
                      <span>Backend procesa con SDK de MP</span>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="mb-2 font-medium text-sm">
                        Response de Mercado Pago:
                      </p>
                      <ScrollArea className="h-40">
                        <pre className="font-mono text-xs">
                          {JSON.stringify(
                            {
                              id: 1_234_567_890,
                              status: "approved",
                              status_detail: "accredited",
                              date_approved: "2024-01-15T10:30:00.000Z",
                              payment_method_id: "visa",
                              payment_type_id: "credit_card",
                              transaction_amount: customAmount,
                              currency_id: "UYU",
                              payer: {
                                id: 123_456,
                                email: "user@email.com",
                              },
                            },
                            null,
                            2
                          )}
                        </pre>
                      </ScrollArea>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Badge>3</Badge>
                      <span>Frontend recibe confirmación</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Uso en código</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <pre className="font-mono text-xs">
                      {`// Importar componentes
import {
  CheckoutButton,  // Checkout Pro
  PaymentBrick,       // Bricks
  CardForm,           // API
} from "@/components/payments/mercado-pago";

// Checkout Pro - Redirige a MP
<CheckoutButton
  title="Producto"
  unitPrice={1000}
  quantity={1}
/>

// Payment Brick - Embebido
<PaymentBrick
  amount={1000}
  description="Mi producto"
  onSuccess={(id, status) => {
    console.log("Pago:", id, status);
  }}
  onError={(error) => {
    console.error(error);
  }}
/>

// Checkout API - Control total
<CardForm
  amount={1000}
  description="Mi producto"
  onSuccess={(id, status) => {
    // Persistir en base de datos
    savePayment(id, status);
  }}
/>`}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* SUBSCRIPTIONS TAB */}
        <TabsContent className="space-y-6" value="subscriptions">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Plan Selection and Subscription */}
            <div className="space-y-6">
              {/* Step 1: Select Plan */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCcw className="h-5 w-5" />
                    Paso 1: Seleccionar Plan
                  </CardTitle>
                  <CardDescription>
                    Selecciona un plan existente o crea uno nuevo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PlanList
                    onSelect={setSelectedPlan}
                    selectedPlanId={selectedPlan?.id}
                  />
                </CardContent>
              </Card>

              {/* Step 2: Subscribe */}
              {selectedPlan && (
                <Card>
                  <CardHeader>
                    <CardTitle>Paso 2: Suscribirse</CardTitle>
                    <CardDescription>
                      Plan seleccionado:{" "}
                      <strong>
                        {selectedPlan.reason} -{" "}
                        {formatPlanPrice(
                          selectedPlan.transactionAmount,
                          selectedPlan.currencyId
                        )}{" "}
                        {formatFrequency(
                          selectedPlan.frequency,
                          selectedPlan.frequencyType
                        )}
                      </strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="checkout">
                      <TabsList className="w-full">
                        <TabsTrigger className="flex-1" value="checkout">
                          Checkout MP
                        </TabsTrigger>
                        <TabsTrigger className="flex-1" value="form">
                          Formulario
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent className="pt-4" value="checkout">
                        <div className="space-y-4">
                          <p className="text-muted-foreground text-sm">
                            El usuario será redirigido a Mercado Pago para
                            completar la suscripción.
                          </p>
                          <Button
                            className="w-full"
                            onClick={() => {
                              if (selectedPlan.initPoint) {
                                window.open(selectedPlan.initPoint, "_blank");
                              }
                            }}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Ir a Mercado Pago
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent className="pt-4" value="form">
                        <SubscriptionForm
                          onError={handlePaymentError}
                          onSuccess={handleSubscriptionSuccess}
                          planId={selectedPlan.id}
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {subscriptionResult && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Suscripción Creada</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1 font-mono text-sm">
                      <p>ID: {subscriptionResult.id}</p>
                      <p className="truncate">
                        Init Point: {subscriptionResult.initPoint}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Right: Documentation */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ciclo de Vida de Suscripciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      {
                        status: "pending",
                        desc: "Esperando autorización del usuario",
                        color: "bg-yellow-500",
                      },
                      {
                        status: "authorized",
                        desc: "Usuario autorizó, esperando primer cobro",
                        color: "bg-blue-500",
                      },
                      {
                        status: "active",
                        desc: "Suscripción activa con cobros recurrentes",
                        color: "bg-green-500",
                      },
                      {
                        status: "paused",
                        desc: "Pausada temporalmente",
                        color: "bg-orange-500",
                      },
                      {
                        status: "cancelled",
                        desc: "Cancelada definitivamente",
                        color: "bg-red-500",
                      },
                    ].map((item) => (
                      <div
                        className="flex items-center gap-3"
                        key={item.status}
                      >
                        <div className={`h-3 w-3 rounded-full ${item.color}`} />
                        <div>
                          <p className="font-medium text-sm">{item.status}</p>
                          <p className="text-muted-foreground text-xs">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>APIs de Suscripciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-4">
                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-600">GET</Badge>
                          <code className="text-sm">
                            /api/payments/mercado-pago/subscriptions/plans
                          </code>
                        </div>
                        <p className="mt-1 text-muted-foreground text-sm">
                          Listar planes disponibles
                        </p>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600">POST</Badge>
                          <code className="text-sm">
                            /api/payments/mercado-pago/subscriptions/plans
                          </code>
                        </div>
                        <p className="mt-1 text-muted-foreground text-sm">
                          Crear plan de suscripción
                        </p>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600">POST</Badge>
                          <code className="text-sm">
                            /api/payments/mercado-pago/subscriptions/plans/sync
                          </code>
                        </div>
                        <p className="mt-1 text-muted-foreground text-sm">
                          Sincronizar planes desde Mercado Pago
                        </p>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600">POST</Badge>
                          <code className="text-sm">
                            /api/payments/mercado-pago/subscriptions
                          </code>
                        </div>
                        <p className="mt-1 text-muted-foreground text-sm">
                          Crear nueva suscripción
                        </p>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-600">GET</Badge>
                          <code className="text-sm">
                            /api/payments/mercado-pago/subscriptions/:id
                          </code>
                        </div>
                        <p className="mt-1 text-muted-foreground text-sm">
                          Obtener detalle de suscripción
                        </p>
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-600">PUT</Badge>
                          <code className="text-sm">
                            /api/payments/mercado-pago/subscriptions/:id
                          </code>
                        </div>
                        <p className="mt-1 text-muted-foreground text-sm">
                          Pausar, reanudar o cancelar
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* WEBHOOKS TAB */}
        <TabsContent className="space-y-6" value="webhooks">
          {/* Real-time Events Monitor - listenToAll for demo purposes */}
          <PaymentEventsMonitor listenToAll />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    ¿Qué son los Webhooks?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Los webhooks son notificaciones HTTP que Mercado Pago envía
                    a tu servidor cuando ocurren eventos importantes, como:
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-500" />
                      Pago aprobado o rechazado
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-500" />
                      Suscripción activada o cancelada
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-500" />
                      Contracargo recibido
                    </li>
                    <li className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-500" />
                      Reembolso procesado
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configuración del Webhook</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="mb-2 font-medium text-sm">URL del Webhook:</p>
                    <code className="text-sm">
                      https://tu-dominio.com/api/payments/mercado-pago/webhook
                    </code>
                  </div>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Importante</AlertTitle>
                    <AlertDescription>
                      Debes configurar esta URL en el panel de Mercado Pago
                      Developers bajo "Webhooks" → "Notificaciones".
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Estructura del Webhook</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <pre className="font-mono text-xs">
                      {JSON.stringify(
                        {
                          id: 12_345,
                          live_mode: true,
                          type: "payment",
                          date_created: "2024-01-15T10:30:00.000-04:00",
                          user_id: 123_456_789,
                          api_version: "v1",
                          action: "payment.updated",
                          data: {
                            id: "1234567890",
                          },
                        },
                        null,
                        2
                      )}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Persistencia de Estados</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <pre className="font-mono text-xs">
                      {`// Ejemplo de handler de webhook
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  // 1. Validar la firma del webhook (recomendado)
  // const isValid = validateWebhookSignature(body);
  
  // 2. Obtener detalles del pago
  const paymentId = body.data.id;
  const payment = await mercadopago.payment.get(paymentId);
  
  // 3. Persistir en base de datos
  await db.payments.upsert({
    where: { externalId: paymentId },
    create: {
      externalId: paymentId,
      status: payment.status,
      amount: payment.transaction_amount,
      userId: payment.metadata?.userId,
      createdAt: payment.date_created,
    },
    update: {
      status: payment.status,
      updatedAt: new Date(),
    },
  });
  
  // 4. Acciones según estado
  if (payment.status === "approved") {
    await activateUserPremium(payment.metadata?.userId);
  }
  
  return { success: true };
});`}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* REFERENCE TAB */}
        <TabsContent className="space-y-6" value="reference">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Variables de Entorno</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-4">
                    <div className="rounded-lg border p-3">
                      <code className="font-bold text-sm">
                        MERCADO_PAGO_ACCESS_TOKEN
                      </code>
                      <p className="mt-1 text-muted-foreground text-sm">
                        Token de acceso del backend (privado). Obtenido en el
                        panel de desarrolladores.
                      </p>
                      <Badge className="mt-2" variant="outline">
                        Backend
                      </Badge>
                    </div>

                    <div className="rounded-lg border p-3">
                      <code className="font-bold text-sm">
                        VITE_MERCADO_PAGO_PUBLIC_KEY
                      </code>
                      <p className="mt-1 text-muted-foreground text-sm">
                        Public Key para inicializar el SDK en el frontend.
                      </p>
                      <Badge className="mt-2" variant="outline">
                        Frontend
                      </Badge>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rutas API del Backend</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600">POST</Badge>
                        <code className="text-sm">
                          /api/payments/mercado-pago/preference
                        </code>
                      </div>
                      <p className="mt-1 text-muted-foreground text-sm">
                        Crea una preferencia para Checkout Pro
                      </p>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600">POST</Badge>
                        <code className="text-sm">
                          /api/payments/mercado-pago/process-payment
                        </code>
                      </div>
                      <p className="mt-1 text-muted-foreground text-sm">
                        Procesa un pago con token (Bricks/API)
                      </p>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600">POST</Badge>
                        <code className="text-sm">
                          /api/payments/mercado-pago/webhook
                        </code>
                      </div>
                      <p className="mt-1 text-muted-foreground text-sm">
                        Endpoint para recibir notificaciones de MP
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Tarjetas de Prueba</CardTitle>
                <CardDescription>
                  Usa estas tarjetas en el ambiente de sandbox para probar
                  diferentes escenarios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-green-500/50 bg-green-500/5 p-4">
                    <p className="mb-2 font-medium text-green-600">
                      Pago Aprobado
                    </p>
                    <p className="font-mono text-sm">5031 7557 3453 0604</p>
                    <p className="text-muted-foreground text-xs">
                      CVV: 123 | Exp: 11/25
                    </p>
                  </div>

                  <div className="rounded-lg border border-red-500/50 bg-red-500/5 p-4">
                    <p className="mb-2 font-medium text-red-600">
                      Pago Rechazado
                    </p>
                    <p className="font-mono text-sm">5031 7557 3453 0604</p>
                    <p className="text-muted-foreground text-xs">
                      CVV: 123 | Exp: 11/25 | Nombre: APRO
                    </p>
                  </div>

                  <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4">
                    <p className="mb-2 font-medium text-yellow-600">
                      Pago Pendiente
                    </p>
                    <p className="font-mono text-sm">5031 7557 3453 0604</p>
                    <p className="text-muted-foreground text-xs">
                      CVV: 123 | Exp: 11/25 | Nombre: CONT
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <Card className="bg-muted/50">
        <CardContent className="py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">¿Necesitas más ayuda?</h3>
              <p className="text-muted-foreground text-sm">
                Consulta la documentación oficial de Mercado Pago
              </p>
            </div>
            <a
              className="inline-flex items-center gap-2 text-primary text-sm hover:underline"
              href="https://www.mercadopago.com.uy/developers"
              rel="noopener noreferrer"
              target="_blank"
            >
              Documentación de Mercado Pago
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
