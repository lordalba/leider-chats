/**
 * An expected failure with an HTTP status (bad input, not allowed, not found).
 * Throw it from a controller or service; the error middleware turns it into a JSON response.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }

  static badRequest(message = "Bad request.") {
    return new HttpError(400, message);
  }

  static unauthorized(message = "Please log in.") {
    return new HttpError(401, message);
  }

  static forbidden(message = "You are not allowed to do that.") {
    return new HttpError(403, message);
  }

  static notFound(message = "Not found.") {
    return new HttpError(404, message);
  }
}
