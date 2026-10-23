import { HttpException } from "@nestjs/common";
export const fail = (message: string, status: number): never => {
  throw new HttpException({ message }, status);
};
