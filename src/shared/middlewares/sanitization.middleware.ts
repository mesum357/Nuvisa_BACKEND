import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
const sanitizeHtml = require('sanitize-html');

@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {

        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = this.sanitizeInput(req.body[key]);
            }
        }
        next();
    }

    sanitizeInput(userInput) {
        return sanitizeHtml(userInput, { allowedTags: [] }).trim();
    }
}