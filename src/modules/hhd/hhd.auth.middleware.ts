import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { HHDUser, IHHDUser } from './hhd.models';
import { UserRole } from './hhd.constants';

interface HHDJwtPayload {
  id: string;
}

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error('[HHD Auth] JWT_SECRET is not configured');
    throw new AppError('Authentication service misconfigured', 500, 'INTERNAL_ERROR');
  }
  return secret;
}

/**
 * HHD-specific JWT protect middleware.
 * Verifies the Bearer token, loads the HHD user and attaches it to req.hhdUser.
 */
export async function protect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Not authorized to access this route', 401, 'AUTH_REQUIRED'));
    }

    let decoded: HHDJwtPayload;
    try {
      decoded = jwt.verify(token, requireJwtSecret()) as HHDJwtPayload;
    } catch (err) {
      const msg = (err as Error).name;
      logger.warn('[HHD Auth] JWT verification failed', { error: (err as Error).message });
      if (msg === 'TokenExpiredError') {
        return next(new AppError('Session expired. Please sign in again.', 401, 'SESSION_EXPIRED'));
      }
      return next(new AppError('Not authorized to access this route', 401, 'AUTH_REQUIRED'));
    }

    const user = await HHDUser.findById(decoded.id).select('-password').lean<IHHDUser>();
    if (!user) {
      return next(new AppError('Session expired. Please sign in again.', 401, 'SESSION_EXPIRED'));
    }

    if (user.isActive === false) {
      return next(new AppError('User account is inactive', 403, 'USER_INACTIVE'));
    }

    req.hhdUser = {
      id: (user._id as { toString(): string }).toString(),
      mobile: user.mobile || '',
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * HHD role-based authorization. Must be used after protect().
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.hhdUser) {
      return next(new AppError('Not authorized to access this route', 401, 'AUTH_REQUIRED'));
    }
    if (!roles.includes(req.hhdUser.role as UserRole)) {
      return next(
        new AppError(
          `User role '${req.hhdUser.role}' is not authorized to access this route`,
          403,
          'ACCESS_DENIED',
        ),
      );
    }
    next();
  };
}
