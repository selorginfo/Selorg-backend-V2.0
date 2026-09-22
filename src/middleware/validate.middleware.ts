import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';
import { ResponseFormatter } from '../utils/response';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Validates `req[part]` against a Zod schema and replaces it with the parsed
 * (and therefore coerced/defaulted) value. On failure, responds 422 with a
 * `{ field, message }[]` list via ResponseFormatter — matches every module's
 * `<feature>.validation.ts` schemas.
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const errors = (result.error as ZodError).issues.map((issue) => ({
        field: issue.path.join('.') || part,
        message: issue.message,
      }));
      console.error('[VALIDATION]', { url: req.originalUrl, part, errors, raw: req[part] });
      res.status(422).json(ResponseFormatter.validationError(errors, errors[0]?.message || 'Validation failed'));
      return;
    }
    (req[part] as unknown) = result.data;
    next();
  };
}
