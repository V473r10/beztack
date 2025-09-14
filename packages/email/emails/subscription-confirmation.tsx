import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface SubscriptionConfirmationEmailProps {
  username?: string;
  planName?: string;
  amount?: string;
  billingPeriod?: string;
  dashboardUrl?: string;
}

export const SubscriptionConfirmationEmail = ({
  username = "User",
  planName = "Pro",
  amount = "$29",
  billingPeriod = "mes",
  dashboardUrl = "https://nvn.app/billing",
}: SubscriptionConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>Confirmación de suscripción a nvn {planName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={title}>¡Suscripción Confirmada!</Text>
        <Text style={paragraph}>Hola {username},</Text>
        <Text style={paragraph}>
          ¡Gracias por suscribirte al plan <strong>{planName}</strong> de nvn!
          Tu suscripción está ahora activa.
        </Text>

        <div style={detailsContainer}>
          <Text style={detailsTitle}>Detalles de la Suscripción:</Text>
          <Text style={detailsItem}>
            <strong>Plan:</strong> {planName}
          </Text>
          <Text style={detailsItem}>
            <strong>Precio:</strong> {amount} por {billingPeriod}
          </Text>
          <Text style={detailsItem}>
            <strong>Estado:</strong> Activo
          </Text>
        </div>

        <Hr style={hr} />

        <Text style={paragraph}>
          Ahora tenés acceso a todas las funcionalidades premium de tu plan.
          Podés gestionar tu suscripción desde tu panel de control:
        </Text>

        <Button href={dashboardUrl} style={button}>
          Ver Panel de Control
        </Button>

        <Text style={paragraph}>
          Si tenés alguna pregunta sobre tu suscripción, no dudes en
          contactarnos.
        </Text>

        <Text style={footer}>
          Saludos,
          <br />
          El equipo de nvn
        </Text>
      </Container>
    </Body>
  </Html>
);

export default SubscriptionConfirmationEmail;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  backgroundColor: "#ffffff",
  borderRadius: "5px",
  maxWidth: "580px",
};

const title = {
  fontSize: "24px",
  lineHeight: "28px",
  fontWeight: "600",
  color: "#16a34a",
  padding: "0 40px",
  marginBottom: "30px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#525f7f",
  padding: "0 40px",
  marginBottom: "20px",
};

const detailsContainer = {
  backgroundColor: "#f8fafc",
  borderRadius: "5px",
  padding: "20px",
  margin: "20px 40px",
};

const detailsTitle = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#374151",
  marginBottom: "15px",
};

const detailsItem = {
  fontSize: "16px",
  color: "#525f7f",
  marginBottom: "8px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "30px 40px",
};

const button = {
  backgroundColor: "#16a34a",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "200px",
  padding: "14px 0",
  margin: "0 auto 20px",
};

const footer = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#8898aa",
  padding: "0 40px",
  marginTop: "30px",
};
