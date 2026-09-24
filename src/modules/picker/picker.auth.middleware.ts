import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PickerUser, parseWorkforceRole, effectiveWorkforceRole, type WorkforceRole } from './picker.models';
import {
  PICKER_JWT_SECRET,
  isAllowedWorkforceTokenAudience,
} from './picker.auth.service';
import { ResponseFormatter } from '../../utils/response';

/**
 * Verifies a workforce (picker/rider) JWT and populates `req.pickerId` / `req.picker`.
 *
 * Guarantees:
 *  - a token minted for another audience (admin, customer, HHD) can never
 *    authenticate here, even if its subject happens to collide with a picker id;
 *  - role-specific audiences (`selorg-picker` / `selorg-rider`) cannot cross apps;
 *  - the token's `sid` must still match `PickerUser.sessionToken`, which is what
 *    makes logout and refresh invalidate outstanding tokens;
 *  - when the client declares `x-selorg-client: rider|picker`, the account's
 *    workforceRole must match (legacy unset role counts as rider);
 *  - token `workforceRole` claim must match the account when present.
 */

function sendAuthError(res: Response, status: number, appCode: string, message: string): void {
  res.status(status).json(ResponseFormatter.error(message, status, null, { appCode }));
}

function readToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function authenticatePickerInner(
  req: Request,
  res: Response,
  next: NextFunction,
  opts: { allowSuspended?: boolean } = {},
): Promise<void> {
  try {
    const token = readToken(req);
    if (!token) {
      sendAuthError(res, 401, 'AUTH_TOKEN_REQUIRED', 'Access token required.');
      return;
    }

    let decoded: jwt.JwtPayload;
    try {
      // Verified without an `audience` option so tokens minted before the claim
      // was introduced keep working; a *foreign* audience is rejected below.
      decoded = jwt.verify(token, PICKER_JWT_SECRET) as jwt.JwtPayload;
    } catch (err) {
      const message = (err as Error).name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.';
      sendAuthError(res, 401, 'AUTH_TOKEN_INVALID', message);
      return;
    }

    const audiences = decoded.aud ? ([] as string[]).concat(decoded.aud as string | string[]) : [];

    const userId = decoded.userId || decoded.sub || decoded.id;
    if (!userId || !/^[a-f\d]{24}$/i.test(String(userId))) {
      sendAuthError(res, 401, 'AUTH_TOKEN_INVALID', 'Invalid token payload.');
      return;
    }

    const user = (await PickerUser.findById(userId)
      .select('_id sessionToken status deliveryMode currentLocationId activeShiftId isOnline workforceRole')
      .lean()) as any;
    if (!user) {
      sendAuthError(res, 401, 'AUTH_USER_NOT_FOUND', 'User not found.');
      return;
    }

    const workforceRole = effectiveWorkforceRole(user);
    if (!isAllowedWorkforceTokenAudience(audiences, workforceRole)) {
      sendAuthError(res, 401, 'AUTH_TOKEN_INVALID', 'This token is not valid for this app.');
      return;
    }

    const tokenRole = parseWorkforceRole((decoded as { workforceRole?: unknown }).workforceRole);
    if (tokenRole && tokenRole !== workforceRole) {
      sendAuthError(res, 401, 'AUTH_TOKEN_INVALID', 'This token is not valid for this account.');
      return;
    }

    // Tokens minted with `sid` are bound to PickerUser.sessionToken. Logout clears
    // sessionToken to null — treat missing/mismatched session as expired so the
    // old JWT cannot keep authenticating after logout/refresh rotation.
    if (decoded.sid) {
      if (!user.sessionToken || decoded.sid !== user.sessionToken) {
        sendAuthError(res, 401, 'AUTH_SESSION_EXPIRED', 'Session expired. Please log in again.');
        return;
      }
    }

    if (user.status === 'SUSPENDED' && !opts.allowSuspended) {
      sendAuthError(res, 403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended.');
      return;
    }

    const clientRole = parseWorkforceRole(req.headers['x-selorg-client']);
    if (clientRole && clientRole !== workforceRole) {
      const other = clientRole === 'rider' ? 'Picker' : 'Rider';
      sendAuthError(
        res,
        403,
        'ROLE_MISMATCH',
        `This account is registered as a ${other.toLowerCase()}. Please use the ${other} app.`,
      );
      return;
    }

    req.pickerId = String(user._id);
    req.picker = {
      id: String(user._id),
      status: user.status,
      deliveryMode: user.deliveryMode || 'standard',
      currentLocationId: user.currentLocationId ?? null,
      activeShiftId: user.activeShiftId ? String(user.activeShiftId) : null,
      isOnline: Boolean(user.isOnline),
      workforceRole,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export async function authenticatePicker(req: Request, res: Response, next: NextFunction): Promise<void> {
  return authenticatePickerInner(req, res, next);
}

/** Lets `/onboarding/state` return `SUSPENDED` so the status gate can render. */
export async function authenticatePickerAllowSuspended(req: Request, res: Response, next: NextFunction): Promise<void> {
  return authenticatePickerInner(req, res, next, { allowSuspended: true });
}

/**
 * Additionally requires an approved account. Used by the operational endpoints
 * (orders, bulk, cash, shifts) which a rider still in onboarding must not reach —
 * `authenticatePicker` alone deliberately admits `PENDING` riders so they can
 * complete onboarding and read their own profile.
 */
export function requireActivePicker(req: Request, res: Response, next: NextFunction): void {
  const status = req.picker?.status;
  if (status === 'ACTIVE') {
    next();
    return;
  }
  if (status === 'REJECTED') {
    sendAuthError(res, 403, 'ACCOUNT_REJECTED', 'Your application was not approved.');
    return;
  }
  if (status === 'BLOCKED' || status === 'INACTIVE') {
    sendAuthError(res, 403, 'ACCOUNT_INACTIVE', 'Your account is inactive. Please contact your hub manager.');
    return;
  }
  if (status === 'DELETION_PENDING') {
    sendAuthError(res, 403, 'ACCOUNT_DELETION_PENDING', 'Your account is scheduled for deletion.');
    return;
  }
  sendAuthError(res, 403, 'ONBOARDING_INCOMPLETE', 'Complete your onboarding before taking deliveries.');
}

/** Restrict a route family to rider or picker accounts (and matching client header when present). */
export function requireWorkforceRole(...allowed: WorkforceRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.picker?.workforceRole || parseWorkforceRole(req.headers['x-selorg-client']);
    if (role && !allowed.includes(role)) {
      const want = allowed.map((r) => (r === 'picker' ? 'Picker' : 'Rider')).join(' or ');
      sendAuthError(res, 403, 'ROLE_MISMATCH', `This endpoint is only available for ${want} accounts.`);
      return;
    }
    next();
  };
}
