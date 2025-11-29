import { removeImportsForPackage } from "./shared.js";

export async function run() {
  await removeImportsForPackage("@beztack/email");
}
