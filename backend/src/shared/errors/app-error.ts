export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(options: {
    message: string;
    statusCode: number;
    code: string;
    details?: unknown;
    expose?: boolean;
  }) {
    super(options.message);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.expose = options.expose ?? true;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
