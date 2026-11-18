import { links } from "../_shared/links";

export type RoomId =
  | "billing"
  | "access"
  | "teams"
  | "admin"
  | "library"
  | "languages"
  | "tests"
  | "yours";

export type Room = {
  id: RoomId;
  name: string;
  /** Short note drawn inside the room, like an area on a plan. */
  note: string;
  /** Position on the 1000 x 620 plan. */
  x: number;
  y: number;
  w: number;
  h: number;
  summary: string;
  items: string[];
  link?: { href: string; label: string };
};

export const ROOMS: Room[] = [
  {
    id: "billing",
    name: "Cobros",
    note: "Mercado Pago + Polar",
    x: 40,
    y: 40,
    w: 440,
    h: 290,
    summary:
      "Mercado Pago cobra en moneda local en Latinoamérica. Polar vende al mundo como merchant of record y se encarga de los impuestos. Una variable de entorno elige el proveedor, y la API nunca pregunta cuál es.",
    items: [
      "Subir de plan, con vista previa del prorrateo antes de aceptar",
      "Bajar de plan al renovar, anotado en un registro que no se borra",
      "Pasar de mensual a anual donde el proveedor lo permite",
      "Reintento desde el admin cuando un cambio falla cinco veces",
      "Precios en unidades mínimas, siempre con su moneda",
    ],
    link: { href: links.planChanges, label: "Cómo funcionan los cambios de plan" },
  },
  {
    id: "access",
    name: "Entrada",
    note: "Better Auth",
    x: 480,
    y: 40,
    w: 200,
    h: 160,
    summary:
      "Login con email y contraseña, y una segunda llave con app autenticadora. Las contraseñas que aparecen en filtraciones conocidas no pasan.",
    items: [
      "Códigos de doble factor (TOTP)",
      "Chequeo con Have I Been Pwned al registrarse, cambiar o resetear",
      "Mensajes claros cuando falla el doble factor",
    ],
    link: { href: links.auth, label: "Docs de autenticación" },
  },
  {
    id: "teams",
    name: "Equipos",
    note: "orgs, equipos, roles",
    x: 680,
    y: 40,
    w: 280,
    h: 290,
    summary:
      "Organizaciones con equipos, invitaciones por email y roles. Elegís si cobrás a cada persona o a cada organización.",
    items: [
      "Cada usuario nuevo arranca con su propia organización (se puede apagar)",
      "Invitaciones con su propio email de React Email",
      "Rol de admin de la app aparte de los roles de cada organización",
    ],
  },
  {
    id: "admin",
    name: "Oficina",
    note: "admin",
    x: 480,
    y: 200,
    w: 200,
    h: 130,
    summary: "Un área de administración para quien opera el producto, no para el cliente.",
    items: [
      "Usuarios y analíticas",
      "Cambios de plan fallidos, listos para reintentar",
      "Planes asignados a mano, sin cobrar y sin tocar la suscripción real",
      "Sincronizar el catálogo de planes con el proveedor",
    ],
  },
  {
    id: "library",
    name: "Biblioteca",
    note: "para tus agentes",
    x: 40,
    y: 330,
    w: 260,
    h: 250,
    summary:
      "El repo se explica solo, para personas y para agentes de código. Las decisiones grandes están escritas con su porqué.",
    items: [
      "AGENTS.md con cómo trabajar en el repo",
      "CONTEXT.md, un glosario del dominio",
      "7 decisiones de arquitectura (ADR)",
      "Todo el sitio de docs en un solo archivo: llms-full.txt",
    ],
    link: { href: links.llms, label: "Abrir llms-full.txt" },
  },
  {
    id: "languages",
    name: "Idiomas",
    note: "en / es",
    x: 300,
    y: 330,
    w: 180,
    h: 250,
    summary:
      "La app viene en inglés y en español escrito con vos. Los montos y las fechas siguen el idioma de quien lee.",
    items: [
      "Un test falla si en el español se cuela un tú",
      "Moneda y locale por defecto definidos al crear el proyecto",
    ],
  },
  {
    id: "tests",
    name: "Tablero",
    note: "127 archivos de tests",
    x: 480,
    y: 330,
    w: 200,
    h: 250,
    summary:
      "Como el tablero eléctrico: no se ve, pero si falla te enterás. Hay tests de unidad y de rutas en la API, la app y los paquetes.",
    items: [
      "127 archivos de tests",
      "Un smoke test contra el sitio publicado",
      "/api/health revisa que la base responda",
    ],
  },
  {
    id: "yours",
    name: "Tu producto",
    note: "a definir por vos",
    x: 680,
    y: 330,
    w: 280,
    h: 250,
    summary:
      "Esta pieza está vacía a propósito. Lo que hace único a tu SaaS va acá, y el resto de la casa ya funciona.",
    items: [],
    link: { href: links.quickStart, label: "Empezá por la guía de inicio" },
  },
];
