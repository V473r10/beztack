import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Beztack - Rediseños de la landing",
  robots: { index: false },
};

const VARIANTS = [
  {
    href: "/redesign/receipt",
    name: "Receipt",
    idea: "El starter como un ticket impreso: cada parte es un renglón, y el total es MIT, $0.00.",
    language: "Inglés",
    look: "Cobalto, papel blanco, sello rojo",
  },
  {
    href: "/redesign/two-markets",
    name: "Two markets",
    idea: "Un switch cambia idioma, formato de precio y proveedor: Mercado Pago en pesos o Polar en dólares.",
    language: "Español e inglés",
    look: "Celeste, sol y azul marino",
  },
  {
    href: "/redesign/floor-plan",
    name: "Floor plan",
    idea: "El starter como una casa en obra gris: un plano con piezas que se recorren.",
    language: "Español con vos",
    look: "Papel de dibujo, grafito, lápiz rojo",
  },
] as const;

export default function RedesignIndex() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16" lang="es">
      <h1 className="mb-3 font-bold text-4xl tracking-tight">Rediseños de la landing</h1>
      <p className="mb-10 text-fd-muted-foreground">
        Tres propuestas para BZ-148. La landing actual sigue en{" "}
        <Link className="underline" href="/">
          /
        </Link>{" "}
        sin cambios.
      </p>
      <ul className="grid gap-4">
        {VARIANTS.map((variant) => (
          <li key={variant.href}>
            <Link
              className="block rounded-lg border p-6 transition-colors hover:bg-fd-accent"
              href={variant.href}
            >
              <span className="block font-semibold text-xl">{variant.name}</span>
              <span className="mt-1 block">{variant.idea}</span>
              <span className="mt-3 block text-fd-muted-foreground text-sm">
                {variant.language}. {variant.look}.
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
