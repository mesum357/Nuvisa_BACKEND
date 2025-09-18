import { HttpException, HttpStatus } from "@nestjs/common";

export const callHTTPException = (exceptionMessage) => {
    throw new HttpException(exceptionMessage, HttpStatus.BAD_REQUEST);
}

