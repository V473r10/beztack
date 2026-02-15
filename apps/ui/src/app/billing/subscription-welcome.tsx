/**
 * Subscription Welcome Page
 * Displays a welcome message after Mercado Pago subscription checkout
 * Uses the app's global theme system
 */
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  CreditCard,
  Home,
  Loader2,
  LogIn,
  Receipt,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  formatAmount,
  formatFrequency,
  getStatusLabel,
  useSubscriptionDetails,
} from "@/hooks/use-subscription-details";
import { authClient } from "@/lib/auth-client";

/**
 * Loading state component
 */
function LoadingSkeleton() {
  return (
    <div className="container mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center px-4 py-16">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">
            Cargando informacion de tu suscripcion...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Error display component
 */
function ErrorDisplay({
  error,
  onRetry,
  onGoHome,
}: {
  error: Error;
  onRetry: () => void;
  onGoHome: () => void;
}) {
  const errorMessages: Record<string, { title: string; description: string }> =
    {
      SUBSCRIPTION_NOT_FOUND: {
        title: "Suscripcion no encontrada",
        description:
          "No pudimos encontrar la suscripcion. Verifica que el enlace sea correcto.",
      },
      SUBSCRIPTION_ACCESS_DENIED: {
        title: "Acceso denegado",
        description:
          "No tienes permisos para ver esta suscripcion. Por favor inicia sesion con la cuenta correcta.",
      },
      SUBSCRIPTION_ID_REQUIRED: {
        title: "Enlace incompleto",
        description:
          "El enlace no contiene la informacion necesaria. Por favor usa el enlace completo que recibiste.",
      },
      SUBSCRIPTION_FETCH_ERROR: {
        title: "Error de conexion",
        description:
          "No pudimos conectar con el servidor. Por favor intenta de nuevo.",
      },
    };

  const errorInfo = errorMessages[error.message] || {
    title: "Error inesperado",
    description: "Ocurrio un error al cargar tu suscripcion.",
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] max-w-md items-center justify-center px-4 py-16">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle>{errorInfo.title}</CardTitle>
          <CardDescription>{errorInfo.description}</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          {error.message === "SUBSCRIPTION_FETCH_ERROR" && (
            <Button
              className="w-full gap-2"
              onClick={onRetry}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              Intentar de nuevo
            </Button>
          )}
          <Button className="w-full" onClick={onGoHome}>
            Ir al inicio
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Missing preapproval_id display
 */
function MissingIdDisplay({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="container mx-auto flex min-h-[80vh] max-w-md items-center justify-center px-4 py-16">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <CardTitle>Enlace incompleto</CardTitle>
          <CardDescription>
            Este enlace no contiene la informacion de tu suscripcion. Si acabas
            de suscribirte, revisa el correo de confirmacion o contacta a
            soporte.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={onGoHome}>
            Ir al inicio
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Main subscription welcome page component
 */
export default function SubscriptionWelcome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get query parameters
  const preapprovalId = searchParams.get("preapproval_id");

  // Auth state
  const { data: session } = authClient.useSession();
  const isAuthenticated = !!session?.user;
  const userName = session?.user?.name || undefined;

  // Fetch subscription details
  const {
    data: subscription,
    isLoading,
    error,
    refetch,
  } = useSubscriptionDetails(preapprovalId);

  // Navigation handlers
  const handleNavigateToDashboard = () => navigate("/");
  const handleNavigateToBilling = () => navigate("/billing");
  const handleNavigateToLogin = () => navigate("/auth/sign-in");

  // Handle missing preapproval_id
  if (!preapprovalId) {
    return <MissingIdDisplay onGoHome={handleNavigateToDashboard} />;
  }

  // Handle loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorDisplay
        error={error}
        onGoHome={handleNavigateToDashboard}
        onRetry={() => refetch()}
      />
    );
  }

  // Handle no data (shouldn't happen if no error)
  if (!subscription) {
    return <LoadingSkeleton />;
  }

  const statusInfo = getStatusLabel(subscription.status);
  const formattedPrice = formatAmount(
    subscription.price.amount,
    subscription.price.currency
  );
  const formattedFrequency = formatFrequency(
    subscription.price.frequency,
    subscription.price.frequencyType
  );

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="space-y-6">
        {/* Success Header */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
            </div>

            <h1 className="mb-2 font-bold text-2xl">
              {isAuthenticated && userName
                ? `Bienvenido, ${userName.split(" ")[0]}!`
                : "Suscripcion exitosa!"}
            </h1>

            <p className="mb-4 text-muted-foreground">
              Tu suscripcion ha sido activada correctamente
            </p>

            <Badge className="gap-1">
              <Sparkles className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
          </CardContent>
        </Card>

        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Detalles del plan
            </CardTitle>
            <CardDescription>
              Informacion de tu suscripcion activa
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Plan name and price */}
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="mb-1 text-muted-foreground text-sm">Tu plan</p>
              <h2 className="mb-2 font-semibold text-xl">
                {subscription.plan.name}
              </h2>
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-bold text-3xl text-primary">
                  {formattedPrice}
                </span>
                <span className="text-muted-foreground">
                  / {formattedFrequency}
                </span>
              </div>
            </div>

            <Separator />

            {/* Info grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {subscription.dates.nextPayment && (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Proximo cobro
                    </p>
                    <p className="font-medium">
                      {subscription.dates.nextPayment.toLocaleDateString(
                        "es-AR",
                        { day: "numeric", month: "long", year: "numeric" }
                      )}
                    </p>
                  </div>
                </div>
              )}

              {subscription.paymentMethod && (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Metodo de pago
                    </p>
                    <p className="font-medium capitalize">
                      {subscription.paymentMethod.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            {isAuthenticated ? (
              <>
                <Button
                  className="w-full gap-2 sm:flex-1"
                  onClick={handleNavigateToDashboard}
                  size="lg"
                >
                  <Home className="h-4 w-4" />
                  Ir al Dashboard
                </Button>
                <Button
                  className="w-full gap-2 sm:flex-1"
                  onClick={handleNavigateToBilling}
                  size="lg"
                  variant="outline"
                >
                  <Receipt className="h-4 w-4" />
                  Gestionar suscripcion
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="w-full gap-2 sm:flex-1"
                  onClick={handleNavigateToLogin}
                  size="lg"
                >
                  <LogIn className="h-4 w-4" />
                  Iniciar sesion
                </Button>
                <Button
                  className="w-full gap-2 sm:flex-1"
                  onClick={handleNavigateToDashboard}
                  size="lg"
                  variant="outline"
                >
                  <Home className="h-4 w-4" />
                  Ir al inicio
                </Button>
              </>
            )}
          </CardFooter>
        </Card>

        {/* Reference ID */}
        <div className="text-center">
          <p className="font-mono text-muted-foreground text-xs">
            Referencia: {subscription.id}
          </p>
        </div>
      </div>
    </div>
  );
}
