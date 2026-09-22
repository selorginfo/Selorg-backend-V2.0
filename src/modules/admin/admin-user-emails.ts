import { sendTransactionalEmail } from '../../services/email.service';
import { logger } from '../../utils/logger';

/**
 * Thin ports of legacy `admin/services/userOnboardingEmailService.js` — reduced to the
 * generic `sendTransactionalEmail` primitive instead of the legacy's own bespoke templates
 * per [[project_selorg_service_migration]]'s established pattern (cross-cutting email
 * delivery lives in `services/email.service.ts`, not per-module). All calls are
 * fire-and-forget from the caller's perspective; failures are logged, never thrown.
 */

export async function sendAdminUserOtpEmail(params: {
  to: string;
  otp: string;
  expiresInMinutes: number;
  requestedByEmail?: string;
}): Promise<void> {
  try {
    await sendTransactionalEmail({
      to: params.to,
      subject: 'Verify your email — Selorg Admin',
      text: `Your email verification code is ${params.otp}. It expires in ${params.expiresInMinutes} minutes.${
        params.requestedByEmail ? ` Requested by ${params.requestedByEmail}.` : ''
      }`,
    });
  } catch (err) {
    logger.warn('sendAdminUserOtpEmail failed', { error: (err as Error).message, to: params.to });
  }
}

export async function sendAdminUserCreatedEmail(params: {
  to: string;
  name: string;
  roleName: string;
  department?: string;
}): Promise<void> {
  try {
    await sendTransactionalEmail({
      to: params.to,
      subject: 'Your Selorg admin account has been created',
      text: `Hi ${params.name}, your Selorg dashboard account has been created with role "${params.roleName}"${
        params.department ? ` in ${params.department}` : ''
      }. Contact your administrator for your login credentials.`,
    });
  } catch (err) {
    logger.warn('sendAdminUserCreatedEmail failed', { error: (err as Error).message, to: params.to });
  }
}

export async function sendAdminCreationConfirmationEmail(params: {
  to?: string;
  createdUserEmail: string;
  createdUserName: string;
  roleName: string;
  department?: string;
}): Promise<void> {
  if (!params.to) return;
  try {
    await sendTransactionalEmail({
      to: params.to,
      subject: 'New admin user created',
      text: `You created a new dashboard user: ${params.createdUserName} <${params.createdUserEmail}>, role "${params.roleName}"${
        params.department ? ` in ${params.department}` : ''
      }.`,
    });
  } catch (err) {
    logger.warn('sendAdminCreationConfirmationEmail failed', { error: (err as Error).message, to: params.to });
  }
}

export async function sendAdminPasswordResetEmail(params: {
  to: string;
  name: string;
  temporaryPassword: string;
}): Promise<void> {
  try {
    await sendTransactionalEmail({
      to: params.to,
      subject: 'Your Selorg admin password has been reset',
      text: `Hi ${params.name}, your dashboard password has been reset. Temporary password: ${params.temporaryPassword}. Please log in and change it immediately.`,
    });
  } catch (err) {
    logger.warn('sendAdminPasswordResetEmail failed', { error: (err as Error).message, to: params.to });
  }
}
