import { removeImportsByPattern, removeImportsForPackage } from "./shared.js";

export async function run() {
  await removeImportsForPackage("@beztack/payments");
  await removeImportsForPackage("@beztack/mercadopago");
  await removeImportsForPackage("@mercadopago/sdk-react");
  await removeImportsForPackage("@polar-sh/sdk");
  await removeImportsForPackage("@polar-sh/better-auth");
  await removeImportsByPattern([
    /\/payments\//,
    /\/membership-context(?:\.tsx|\.ts)?$/,
    /\/use-(polar-products|subscriptions|payment-events|subscription-details)(?:\.tsx|\.ts)?$/,
  ]);
}
