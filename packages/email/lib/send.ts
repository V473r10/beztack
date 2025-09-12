import { Resend } from "resend";
import type { ReactElement } from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailProps {
    to: string;
    subject: string;
    react: ReactElement;
}

export const send = async (props: SendEmailProps) => {
    const { data, error } = await resend.emails.send({
          from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
          to: props.to,
          subject: props.subject,
          // NOTE: Working around cross-package @types/react ReactNode incompatibility.
          // Resend expects a ReactNode from its own types instance; casting avoids TS conflict.
          react: props.react as any,
        });

        if (error) {
            console.error(error);
        }

        return data;
}

export { };
