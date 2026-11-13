import i18next, { type TFunction } from "i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import es from "@/lib/i18n/locales/es.json";

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  verifyTotp: vi.fn(),
  verifyBackupCode: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: mocks.signUp },
    signIn: { email: mocks.signIn },
    twoFactor: { verifyTotp: mocks.verifyTotp, verifyBackupCode: mocks.verifyBackupCode },
  },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { submitBackupCode, submitSignIn, submitSignUp, submitTotp } from "./auth-submissions";

async function translator(lng: "en" | "es"): Promise<TFunction> {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    resources: { en: { translation: en }, es: { translation: es } },
    interpolation: { escapeValue: false },
  });
  return instance.t;
}

let t: TFunction;
const navigate = vi.fn();

const SIGN_UP = { name: "Ada", email: "ada@example.com", password: "Str0ng!pass" };
const CREDENTIALS = { email: "ada@example.com", password: "Str0ng!pass" };

// better-auth's client resolves to `{ data, error }` instead of throwing.
const failure = (error: Record<string, unknown>) => ({ data: null, error });
const success = (data: Record<string, unknown> = {}) => ({ data, error: null });

beforeAll(async () => {
  t = await translator("en");
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitSignUp", () => {
  it("shows the server error and does not navigate when the server answers 500", async () => {
    mocks.signUp.mockResolvedValue(
      failure({ status: 500, statusText: "Internal Server Error", message: "Customer rejected" }),
    );

    const error = await submitSignUp(SIGN_UP, "", { t, navigate });

    expect(error).toBe("Customer rejected");
    expect(mocks.toast.error).toHaveBeenCalledWith("Customer rejected");
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("translates a known error code into the visitor's language", async () => {
    mocks.signUp.mockResolvedValue(
      failure({ status: 422, code: "USER_ALREADY_EXISTS", message: "User already exists." }),
    );

    const error = await submitSignUp(SIGN_UP, "", { t: await translator("es"), navigate });

    expect(error).toBe("Ya existe una cuenta con este email. Iniciá sesión.");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows a generic server message when a 500 carries nothing else", async () => {
    mocks.signUp.mockResolvedValue(failure({ status: 500, statusText: "Internal Server Error" }));

    const error = await submitSignUp(SIGN_UP, "", { t, navigate });

    expect(error).toBe("Something went wrong on our side. Please try again in a moment.");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("reports a request that throws instead of navigating", async () => {
    mocks.signUp.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await submitSignUp(SIGN_UP, "", { t, navigate });

    expect(error).toBe("An unexpected error occurred. Please try again.");
    expect(mocks.toast.error).toHaveBeenCalledWith(error);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("confirms and goes where sign-up started when it succeeds", async () => {
    mocks.signUp.mockResolvedValue(success({ user: { id: "u1" } }));

    const error = await submitSignUp(SIGN_UP, "?next=%2Faccept-invitation%2Finv_1", {
      t,
      navigate,
    });

    expect(error).toBeNull();
    expect(mocks.toast.success).toHaveBeenCalledWith("Account created successfully!");
    expect(navigate).toHaveBeenCalledWith("/accept-invitation/inv_1");
  });
});

describe("submitSignIn", () => {
  it("shows wrong credentials and does not navigate", async () => {
    mocks.signIn.mockResolvedValue(
      failure({
        status: 401,
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      }),
    );

    const error = await submitSignIn(CREDENTIALS, "", { t, navigate });

    expect(error).toBe("Incorrect email or password.");
    expect(mocks.toast.error).toHaveBeenCalledWith("Incorrect email or password.");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("goes to the post sign-in target on success", async () => {
    mocks.signIn.mockResolvedValue(success({ user: { id: "u1" } }));

    expect(await submitSignIn(CREDENTIALS, "", { t, navigate })).toBeNull();

    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("continues to the two-factor step when the server asks for it", async () => {
    mocks.signIn.mockResolvedValue(success({ twoFactorRedirect: true }));

    expect(await submitSignIn(CREDENTIALS, "", { t, navigate })).toBeNull();

    expect(navigate).toHaveBeenCalledWith("/auth/sign-in/two-factor");
  });
});

describe("submitTotp", () => {
  it("shows an invalid code and does not navigate", async () => {
    mocks.verifyTotp.mockResolvedValue(failure({ status: 401, code: "INVALID_TOTP_CODE" }));

    const error = await submitTotp("123456", "", { t, navigate });

    expect(error).toBe("Invalid TOTP code. Please try again.");
    expect(mocks.toast.error).toHaveBeenCalledWith(error);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("navigates on a valid code", async () => {
    mocks.verifyTotp.mockResolvedValue(success());

    expect(await submitTotp("123456", "", { t, navigate })).toBeNull();

    expect(navigate).toHaveBeenCalledWith("/");
  });
});

describe("submitBackupCode", () => {
  it("retries without the dash and navigates when that works", async () => {
    mocks.verifyBackupCode
      .mockResolvedValueOnce(failure({ status: 401, code: "BACKUP_CODE_NOT_FOUND" }))
      .mockResolvedValueOnce(success());

    expect(await submitBackupCode("ABCDE-12345", "", { t, navigate })).toBeNull();

    expect(mocks.verifyBackupCode).toHaveBeenNthCalledWith(1, { code: "ABCDE-12345" });
    expect(mocks.verifyBackupCode).toHaveBeenNthCalledWith(2, { code: "ABCDE12345" });
    expect(mocks.toast.error).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("shows the error and does not navigate when both attempts fail", async () => {
    mocks.verifyBackupCode.mockResolvedValue(
      failure({ status: 401, code: "BACKUP_CODE_NOT_FOUND" }),
    );

    const error = await submitBackupCode("ABCDE-12345", "", { t, navigate });

    expect(error).toBe("Invalid backup code.");
    expect(mocks.toast.error).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});
