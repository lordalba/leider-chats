import "./env";

/** Secret used to sign and verify login tokens (REST and sockets). */
export const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
