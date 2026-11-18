import { Body, Button, Container, Head, Html, Preview, Text } from "@react-email/components";

export const MagicLinkEmail = ({ loginUrl }: { loginUrl: string }) => (
  <Html lang="en">
    <Head />
    <Preview>Sign in to beztack</Preview>
    <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" }}>
      <Container style={{ backgroundColor: "#ffffff", padding: "40px", maxWidth: "580px" }}>
        <Text style={{ fontSize: "24px", fontWeight: "600" }}>Sign in to beztack</Text>
        <Text>Click the link below to sign in to your account.</Text>
        <Button
          href={loginUrl}
          style={{ backgroundColor: "#000", color: "#fff", padding: "14px 24px" }}
        >
          Sign in
        </Button>
        <Text>This link expires in 15 minutes and can only be used once.</Text>
        <Text>If you did not request this email, you can safely ignore it.</Text>
      </Container>
    </Body>
  </Html>
);

export default MagicLinkEmail;
