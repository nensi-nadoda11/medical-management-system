import type { AuthenticatedRequestContext } from "../modules/auth/auth.types";
import type { AccessibleBranch, BranchRequestContext } from "../modules/branches/branches.service";

declare global {
  namespace Express {
    interface Request {
      authSession?: AuthenticatedRequestContext;
      authenticatedUser?: AuthenticatedRequestContext["user"];
      authBranch?: AccessibleBranch;
      authBranchAccess?: BranchRequestContext;
      validatedQuery?: unknown;
    }
  }
}

export {};
