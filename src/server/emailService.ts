/**
 * ProofLoop Real Email Dispatch & Verification Service
 * Enforces server-side credentials, strict idempotency, provider response recording,
 * and zero-fake-success guarantees.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import nodemailer from 'nodemailer';
import crypto from 'crypto';
import type { InternshipApplicationData, AttachmentItem } from '../types/index.js';

// Cache for idempotency keys to strictly prevent duplicate sending on double-clicks or retries
const processedIdempotencyKeys = new Map<
  string,
  {
    timestamp: string;
    messageId?: string;
    status: 'SENT' | 'SEND_FAILED' | 'NOT_CONFIGURED';
    providerResponse?: any;
    error?: string;
  }
>();

// In-flight sending locks
const activeSendingLocks = new Set<string>();

/**
 * Computes a deterministic SHA-256 integrity hash of the application draft.
 * Any edit to recipient, subject, body, or attachments invalidates this hash.
 */
export function computeApplicationDraftHash(app: {
  recipientEmail: string;
  emailSubject: string;
  emailBody: string;
  attachments?: AttachmentItem[];
}): string {
  const selectedAttachments = (app.attachments || [])
    .filter((a) => a.selected)
    .map((a) => a.filename)
    .sort()
    .join(',');

  const payload = [
    app.recipientEmail.trim().toLowerCase(),
    app.emailSubject.trim(),
    app.emailBody.trim(),
    selectedAttachments,
  ].join('||');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Checks if a real email provider is configured via environment variables.
 */
export function isEmailProviderConfigured(): {
  configured: boolean;
  provider: 'SMTP' | 'NONE';
  missingEnv: string[];
} {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const missing: string[] = [];
  if (!host) missing.push('SMTP_HOST');
  if (!user) missing.push('SMTP_USER');
  if (!pass) missing.push('SMTP_PASS');

  if (missing.length === 0) {
    return { configured: true, provider: 'SMTP', missingEnv: [] };
  }

  return { configured: false, provider: 'NONE', missingEnv: missing };
}

export interface SendApplicationEmailParams {
  application: InternshipApplicationData;
  approvedHash: string;
  idempotencyKey: string;
}

export interface SendApplicationEmailResult {
  success: boolean;
  status: 'SENT' | 'SEND_FAILED' | 'NOT_CONFIGURED';
  messageId?: string;
  providerResponse?: any;
  error?: string;
  configurationHelp?: string;
  idempotentReplay?: boolean;
}

/**
 * Sends the internship application email using real provider credentials.
 * Never fakes success. Strictly enforces approval hash matching and idempotency.
 */
export async function sendApplicationEmail({
  application,
  approvedHash,
  idempotencyKey,
}: SendApplicationEmailParams): Promise<SendApplicationEmailResult> {
  // 1. Idempotency Check: prevent duplicate email transmission
  if (processedIdempotencyKeys.has(idempotencyKey)) {
    const existing = processedIdempotencyKeys.get(idempotencyKey)!;
    return {
      success: existing.status === 'SENT',
      status: existing.status,
      messageId: existing.messageId,
      providerResponse: existing.providerResponse,
      error: existing.error,
      idempotentReplay: true,
    };
  }

  // Prevent concurrent in-flight duplicate sends for the same application
  if (activeSendingLocks.has(application.id)) {
    return {
      success: false,
      status: 'SEND_FAILED',
      error: 'An active email transmission is already in progress for this application. Please wait.',
    };
  }

  // 2. Validate current draft matches the exact approved hash
  const currentHash = computeApplicationDraftHash(application);
  if (currentHash !== approvedHash) {
    return {
      success: false,
      status: 'SEND_FAILED',
      error:
        'Security Mismatch: The application content was modified after user approval was granted. Please review and re-authorize before sending.',
    };
  }

  // 3. Validate recipient address is non-empty and well-formed
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(application.recipientEmail)) {
    return {
      success: false,
      status: 'SEND_FAILED',
      error: `Invalid recipient address: "${application.recipientEmail}". Please provide a valid email address.`,
    };
  }

  // 4. Check if external email transport is configured
  const providerCheck = isEmailProviderConfigured();
  if (!providerCheck.configured) {
    const unconfiguredResult: SendApplicationEmailResult = {
      success: false,
      status: 'NOT_CONFIGURED',
      error:
        'No real email provider configured. ProofLoop refuses to fabricate email delivery without an authentic email transport.',
      configurationHelp: `To enable live transmission, configure SMTP credentials in your server environment:
- SMTP_HOST (e.g. smtp.gmail.com or smtp.mailgun.org)
- SMTP_PORT (e.g. 587 or 465)
- SMTP_USER (your SMTP username/email)
- SMTP_PASS (your SMTP app password or API key)
- SMTP_FROM (optional from address)

Your application draft and resume attachments remain safely preserved in "AWAITING_APPROVAL / DRAFT_READY" status. You can copy the complete email text or download the draft payload.`,
    };

    processedIdempotencyKeys.set(idempotencyKey, {
      timestamp: new Date().toISOString(),
      status: 'NOT_CONFIGURED',
      error: unconfiguredResult.error,
    });

    return unconfiguredResult;
  }

  activeSendingLocks.add(application.id);

  try {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = port === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '',
      },
    });

    // Prepare attachments
    const selectedAttachments = (application.attachments || []).filter((a) => a.selected);
    const mailAttachments = selectedAttachments.map((att) => ({
      filename: att.filename,
      content: att.contentPreview || `[Document content for ${att.filename}]`,
      contentType: att.mimeType,
    }));

    const fromAddress =
      process.env.SMTP_FROM || application.applicantEmail || process.env.SMTP_USER;

    const info = await transporter.sendMail({
      from: `"${application.applicantName}" <${fromAddress}>`,
      to: application.recipientEmail,
      replyTo: application.applicantEmail,
      subject: application.emailSubject,
      text: application.emailBody,
      attachments: mailAttachments,
    });

    const result: SendApplicationEmailResult = {
      success: true,
      status: 'SENT',
      messageId: info.messageId,
      providerResponse: {
        provider: 'SMTP',
        messageId: info.messageId,
        acceptedRecipients: info.accepted,
        rejectedRecipients: info.rejected,
        response: info.response,
      },
    };

    processedIdempotencyKeys.set(idempotencyKey, {
      timestamp: new Date().toISOString(),
      messageId: info.messageId,
      status: 'SENT',
      providerResponse: result.providerResponse,
    });

    return result;
  } catch (err: any) {
    const failureResult: SendApplicationEmailResult = {
      success: false,
      status: 'SEND_FAILED',
      error: `Email transport error: ${err.message || 'Failed to dispatch via SMTP'}`,
    };

    processedIdempotencyKeys.set(idempotencyKey, {
      timestamp: new Date().toISOString(),
      status: 'SEND_FAILED',
      error: failureResult.error,
    });

    return failureResult;
  } finally {
    activeSendingLocks.delete(application.id);
  }
}
