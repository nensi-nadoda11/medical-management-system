import { Router } from "express";

import {
  loginRateLimiter,
  otpResendRateLimiter,
  otpVerificationRateLimiter,
  registrationRateLimiter,
} from "../../shared/http/rate-limiters";
import { validateRequest } from "../../shared/http/validate-request";
import { authController } from "./auth.controller";
import { requireAuth } from "./auth.middleware";
import {
  loginSchema,
  registerAdminSchema,
  resendRegistrationOtpSchema,
  verifyRegistrationSchema,
} from "./auth.schemas";

const router = Router();

router.post(
  "/register",
  registrationRateLimiter,
  validateRequest(registerAdminSchema),
  authController.registerAdmin,
);
router.post(
  "/verify-registration",
  otpVerificationRateLimiter,
  validateRequest(verifyRegistrationSchema),
  authController.verifyRegistration,
);
router.post(
  "/resend-registration-otp",
  otpResendRateLimiter,
  validateRequest(resendRegistrationOtpSchema),
  authController.resendRegistrationOtp,
);
router.post("/login", loginRateLimiter, validateRequest(loginSchema), authController.login);
router.get("/session", requireAuth, authController.getSession);
router.post("/logout", authController.logout);

export const authRoutes = router;
