import type { TranslationKeys } from "../types.js";

export const es: TranslationKeys = {
  paymentStatus: {
    pending: "Pendiente",
    approved: "Aprobado",
    authorized: "Autorizado",
    in_process: "En proceso",
    in_mediation: "En mediación",
    rejected: "Rechazado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    charged_back: "Contracargo",
  },

  subscriptionStatus: {
    pending: "Pendiente",
    authorized: "Autorizada",
    active: "Activa",
    paused: "Pausada",
    cancelled: "Cancelada",
  },

  planStatus: {
    active: "Activo",
    inactive: "Inactivo",
  },

  frequency: {
    day: "día",
    days: "días",
    month: "mes",
    months: "meses",
    every: "cada",
    everyN: "cada {n} {unit}",
  },

  components: {
    subscription: "Suscripción",
    nextPayment: "Próximo cobro",
    charges: "Cobros",
    total: "Total",
    createdAt: "Creada",

    pause: "Pausar",
    pausing: "Pausando...",
    resume: "Reanudar",
    resuming: "Reanudando...",
    cancel: "Cancelar",
    cancelling: "Cancelando...",
    cancelConfirm:
      "¿Estás seguro de que deseas cancelar esta suscripción? Esta acción no se puede deshacer.",

    noSubscriptions: "No hay suscripciones",
    loadingSubscriptions: "Cargando suscripciones...",

    billingHistory: "Historial de Facturación",
    noInvoices: "No hay facturas para mostrar",
    loadingHistory: "Cargando historial...",
    attempt: "Intento",
  },

  common: {
    loading: "Cargando...",
    error: "Error",
    retry: "Reintentar",
    close: "Cerrar",
    confirm: "Confirmar",
    save: "Guardar",
  },
};

// es-UY is the same as es for now, but can be customized
export const esUY: TranslationKeys = {
  ...es,
};
