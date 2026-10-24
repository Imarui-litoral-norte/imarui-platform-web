import { AUTH_FORM_MODES } from "@/features/auth/types";
import { forgotPasswordService } from "@/features/auth/services/forgotPassword";
import { loginService } from "@/features/auth/services/login";
import { passwordRecoveryResetService } from "@/features/auth/services/passwordRecoveryReset";
import { registerService, registerTechnicalService } from "@/features/auth/services/register";

const AUTH_SERVICES = {
  [AUTH_FORM_MODES.LOGIN]: loginService,
  [AUTH_FORM_MODES.REGISTER]: registerService,
  [AUTH_FORM_MODES.REGISTER_SERVICE]: registerTechnicalService,
  [AUTH_FORM_MODES.FORGOT_PASSWORD]: forgotPasswordService,
  [AUTH_FORM_MODES.PASSWORD_RECOVERY_RESET]: passwordRecoveryResetService,
};

export function getAuthService(mode) {
  const service = AUTH_SERVICES[mode];

  if (!service) {
    throw new Error(`No auth service configured for mode: ${mode}`);
  }

  return service;
}
