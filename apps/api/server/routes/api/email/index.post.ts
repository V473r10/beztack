import { MyEmail, send } from "@nvn/email";
import { defineEventHandler, readBody } from "h3";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { to, subject } = body;
    

    await send({ to, subject, react: MyEmail });
});