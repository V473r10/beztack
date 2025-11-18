import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components";

type OrganizationInvitationEmailProps = {
  invitedByUsername?: string;
  invitedByEmail?: string;
  organizationName?: string;
  invitationUrl?: string;
};

export const OrganizationInvitationEmail = ({
  invitedByUsername = "Un miembro",
  invitedByEmail = "",
  organizationName = "la organización",
  invitationUrl = "https://beztack.app",
}: OrganizationInvitationEmailProps) => (
  <Html>
    <Head />
    <Preview>
      {invitedByUsername} te invitó a unirte a {organizationName} en beztack
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={title}>Invitación a {organizationName}</Text>
        <Text style={paragraph}>
          {invitedByUsername}
          {invitedByEmail ? ` (${invitedByEmail})` : ""} te ha invitado a unirte
          a <strong>{organizationName}</strong> en beztack.
        </Text>
        <Text style={paragraph}>
          Aceptá la invitación para colaborar con tu equipo y acceder a todos
          los recursos compartidos.
        </Text>
        <Button href={invitationUrl} style={button}>
          Aceptar Invitación
        </Button>
        <Text style={paragraph}>
          Si no esperabas esta invitación o no conocés al remitente, podés
          ignorar este email de forma segura.
        </Text>
        <Text style={footer}>
          Este enlace de invitación es único y personal.
          <br />
          No lo compartas con nadie más.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default OrganizationInvitationEmail;

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
  color: "#374151",
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

const button = {
  backgroundColor: "#000",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "250px",
  padding: "14px 0",
  margin: "0 auto 20px",
};

const footer = {
  fontSize: "14px",
  lineHeight: "24px",
  color: "#8898aa",
  padding: "0 40px",
  marginTop: "30px",
  borderTop: "1px solid #e6ebf1",
  paddingTop: "20px",
};
