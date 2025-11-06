// Simple HTML email templates
export const welcomeEmailTemplate = (
  username = "Usuario",
  loginUrl = "https://beztack.app/login"
) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¡Bienvenido a beztack!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif; background-color: #f6f9fc;">
    <div style="max-width: 580px; margin: 0 auto; padding: 20px 0 48px; background-color: #ffffff; border-radius: 5px;">
        <div style="padding: 0 40px;">
            <h1 style="font-size: 24px; line-height: 28px; font-weight: 600; color: #374151; margin-bottom: 30px;">
                ¡Bienvenido a beztack, ${username}!
            </h1>
            <p style="font-size: 16px; line-height: 26px; color: #525f7f; margin-bottom: 20px;">
                Tu cuenta ha sido creada exitosamente. Ahora podés acceder a todas las funcionalidades de la plataforma.
            </p>
            <p style="font-size: 16px; line-height: 26px; color: #525f7f; margin-bottom: 20px;">
                Para comenzar, iniciá sesión con el siguiente enlace:
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="background-color: #000; border-radius: 5px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block; padding: 14px 24px;">
                    Iniciar Sesión
                </a>
            </div>
            <p style="font-size: 16px; line-height: 26px; color: #525f7f; margin-bottom: 20px;">
                Si tenés alguna pregunta, no dudes en contactarnos. ¡Esperamos que disfrutes usando beztack!
            </p>
            <p style="font-size: 14px; line-height: 24px; color: #8898aa; margin-top: 30px;">
                Saludos,<br>
                El equipo de beztack
            </p>
        </div>
    </div>
</body>
</html>
`;

export const passwordResetTemplate = (username = "Usuario") => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restablecimiento de Contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif; background-color: #f6f9fc;">
    <div style="max-width: 580px; margin: 0 auto; padding: 20px 0 48px; background-color: #ffffff; border-radius: 5px;">
        <div style="padding: 0 40px;">
            <h1 style="font-size: 24px; line-height: 28px; font-weight: 600; color: #374151; margin-bottom: 30px;">
                Restablecimiento de Contraseña
            </h1>
            <p style="font-size: 16px; line-height: 26px; color: #525f7f; margin-bottom: 20px;">
                Hola ${username},
            </p>
            <p style="font-size: 16px; line-height: 26px; color: #525f7f; margin-bottom: 20px;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en beztack.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://beztack.app/reset-password" style="background-color: #dc2626; border-radius: 5px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; display: inline-block; padding: 14px 24px;">
                    Restablecer Contraseña
                </a>
            </div>
            <p style="font-size: 16px; line-height: 26px; color: #525f7f; margin-bottom: 20px;">
                Este enlace expirará en 24 horas por motivos de seguridad.
            </p>
            <p style="font-size: 14px; line-height: 24px; color: #8898aa; margin-top: 30px;">
                Saludos,<br>
                El equipo de beztack
            </p>
        </div>
    </div>
</body>
</html>
`;
