import { ExceptionFilter, Catch, ArgumentsHost, HttpException} from '@nestjs/common';
import { Response } from 'express';
import { EnumAPIResponseStatusType } from '../enums';
import { ObjectTemplateForAPIResponseGeneral } from '../data_templates/ObjectTemplateForAPIResponse';


@Catch(HttpException)
export class ErrorHandler implements ExceptionFilter {
  catch(
    exception: HttpException,
    host: ArgumentsHost,
  ) {

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = exception.getStatus();
    const message = exception.name;
    const errorResponse =
      exception.getResponse() as Record<
        string,
        any
      >;

    const error = errorResponse || '';

    ObjectTemplateForAPIResponseGeneral.status =
      EnumAPIResponseStatusType.ERROR;
    (ObjectTemplateForAPIResponseGeneral.data.results =
    {
      statusCode,
      error,
    }),
      (ObjectTemplateForAPIResponseGeneral.message =
        message);

    response
      .status(statusCode)
      .json(ObjectTemplateForAPIResponseGeneral);
  }
}
