import type { Request, Response, NextFunction } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { AppError } from '../../utils/AppError';
import * as authService from './admin-auth.service';
import type { AdminLoginInput } from './admin.validation';

function requesterIp(req: Request): string | undefined {
  return req.ip || req.socket?.remoteAddress || String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, role } = req.body as AdminLoginInput;

    const lockStatus = authService.checkLockout(email);
    if (lockStatus.locked) {
      throw new AppError('Too many failed login attempts. Please try again later.', 429, 'LOGIN_LOCKED', {
        retryAfterSeconds: lockStatus.retryAfterSeconds,
      });
    }

    const result = await authService.login(email, password, role || 'admin');
    if (!result) {
      authService.recordFailedLogin(email);
      await authService.logAuthEvent({
        action: 'login_failure',
        details: { email: `${email.slice(0, 3)}***`, role: role || 'admin' },
        ip: requesterIp(req),
        userAgent: req.get('user-agent'),
      });
      res.status(401).json(ResponseFormatter.error('Invalid credentials. Please check your email and password.', 401));
      return;
    }

    authService.clearLoginAttempts(email);
    await authService.logAuthEvent({
      action: 'login_success',
      userId: (result.user as { _id?: string })._id?.toString(),
      details: { email: result.user.email, role: result.user.role },
      ip: requesterIp(req),
      userAgent: req.get('user-agent'),
    });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('selorg_admin_token', result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
    });

    res.status(200).json(ResponseFormatter.success(result));
  } catch (err) {
    next(err);
  }
}

export function logout(req: Request, res: Response, next: NextFunction): void {
  try {
    const cookieToken = (req.cookies as Record<string, string | undefined>)?.selorg_admin_token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    const token = cookieToken || bearerToken;
    authService.logout(token);

    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('selorg_admin_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });

    res.status(200).json(ResponseFormatter.success(null, 'Logged out successfully.'));
  } catch (err) {
    next(err);
  }
}
