import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Lets a route handler be async: a thrown error or rejected promise is passed to the
 * error middleware instead of crashing the request (Express 4 doesn't do this by itself).
 */
export const asyncHandler =
  <Req extends Request = Request>(handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
