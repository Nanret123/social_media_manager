import { AuthProvider } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  provider: AuthProvider;
  iat?: number;
  exp?: number;
}