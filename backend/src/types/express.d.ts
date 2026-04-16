import type { AuthenticatedRequestContext } from "../modules/auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      authSession?: AuthenticatedRequestContext;
      authenticatedUser?: AuthenticatedRequestContext["user"];
    }
  }
}

export {};
