import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { MyUserRequest } from "../types/express";

import { JWT_SECRET } from "../config/jwt";

export const authenticate = (req: MyUserRequest, res: Response, next: NextFunction): Response | void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  // console.log("ashkara ze nihnas! ani mevin, ha token: " + token)
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    return next();
  } catch (error) {
    return res.status(403).json({ message: `Invalid token: ${error}` });
  }
};
