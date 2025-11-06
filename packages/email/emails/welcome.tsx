import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components";

type WelcomeEmailProps = {
  username?: string;
  loginUrl?: string;
};

export const WelcomeEmail = ({
  username = "User",
  loginUrl = "https://beztack.app/login",
}: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>¡Bienvenido a beztack! Comenzá a usar tu cuenta ahora.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={title}>¡Bienvenido a beztack, {username}!</Text>
        <Text style={paragraph}>
          Tu cuenta ha sido creada exitosamente. Ahora podés acceder a todas las
          funcionalidades de la plataforma.
        </Text>
        <Text style={paragraph}>
          Para comenzar, iniciá sesión con el siguiente enlace:
        </Text>
        <Button href={loginUrl} style={button}>
          Iniciar Sesión
        </Button>
        <Text style={paragraph}>
          Si tenés alguna pregunta, no dudes en contactarnos. ¡Esperamos que
          disfrutes usando beztack!
        </Text>
        <Text style={footer}>
          Saludos,
          <br />
          El equipo de beztack
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

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
