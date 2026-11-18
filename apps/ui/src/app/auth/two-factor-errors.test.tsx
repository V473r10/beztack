// @vitest-environment jsdom
import { act, useReducer } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import es from "@/lib/i18n/locales/es.json";
import { useTotpVerification } from "../settings/hooks/use-two-factor";
import { TotpVerification } from "../settings/components/two-factor-card/totp-verification";
import { settingsReducer } from "../settings/lib/settings-reducer";
import { INITIAL_SETTINGS_STATE } from "../settings/lib/constants";
import TwoFactor from "./sign-in/two-factor/two-factor";

const mocks = vi.hoisted(() => ({
  verifyTotp: vi.fn(),
  verifyBackupCode: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/env", () => ({ env: { VITE_APP_NAME: "Beztack" } }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: { verifyTotp: mocks.verifyTotp, verifyBackupCode: mocks.verifyBackupCode },
  },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

let container: HTMLDivElement;
let root: Root;
const i18n = i18next.createInstance();

beforeEach(async () => {
  vi.clearAllMocks();
  document.elementFromPoint = () => null;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  await i18n.init({ lng: "es", resources: { es: { translation: es } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(screen: React.ReactNode) {
  await act(async () =>
    root.render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
        >
          <MemoryRouter>{screen}</MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>,
    ),
  );
}

function Setup() {
  const [state, dispatch] = useReducer(settingsReducer, INITIAL_SETTINGS_STATE);
  const verification = useTotpVerification(dispatch, i18n.t);
  return (
    <TotpVerification
      totpCode={state.twoFactor.totpCode || "123456"}
      isVerifying={verification.isPending}
      hasConfirmedBackupCodes
      onCodeChange={() => {}}
      onVerify={() => verification.mutate("123456")}
    />
  );
}

describe("two-factor verification screens", () => {
  it("shows a translated login error instead of the server text", async () => {
    mocks.verifyTotp.mockResolvedValue({
      error: { code: "INVALID_CODE", message: "Raw English error" },
    });
    await render(<TwoFactor />);
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(container.textContent).toContain("Código TOTP inválido.");
    expect(container.textContent).not.toContain("Raw English error");
  });

  it("shows a translated backup-code error", async () => {
    mocks.verifyBackupCode.mockResolvedValue({
      error: { code: "INVALID_BACKUP_CODE", message: "Raw English error" },
    });
    await render(<TwoFactor />);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[role="tab"][data-state="inactive"]')!
        .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    });
    const input = container.querySelector("input")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "ABCDE-12345",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(mocks.verifyBackupCode).toHaveBeenCalled();
    expect(container.textContent).toContain("Código de recuperación inválido.");
    expect(container.textContent).not.toContain("Raw English error");
  });

  it.each([
    [
      "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
      "Demasiados intentos. Solicitá un código nuevo y probá de nuevo.",
    ],
    ["FUTURE_ERROR", "Ocurrió un error inesperado. Por favor, intentá de nuevo."],
  ])("shows the translated setup error for %s", async (code, message) => {
    mocks.verifyTotp.mockResolvedValue({ error: { code, message: "Raw English error" } });
    await render(<Setup />);
    await act(async () => {
      container.querySelector("button")!.click();
    });
    expect(mocks.toast.error).toHaveBeenCalledWith(message);
  });
});
