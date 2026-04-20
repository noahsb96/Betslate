import { Resend } from 'resend';

let _resend = null;
const getResend = () => {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY environment variable is not set');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
};
const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const sendVerificationEmail = async (email, token) => {
  const link = `${BASE_URL}/verify-email?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Confirm your BetSlate account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#202225;color:#dcddde;border-radius:8px">
        <div style="display:flex;align-items:center;margin-bottom:24px">
          <div style="width:36px;height:36px;background:#5865f2;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#fff;font-size:14px;margin-right:12px">BS</div>
          <span style="font-size:20px;font-weight:700;color:#fff">BetSlate AI Automator</span>
        </div>
        <h2 style="color:#fff;margin:0 0 12px">Verify your email address</h2>
        <p style="margin:0 0 24px;color:#b9bbbe">Click the button below to confirm your account. This link expires in 24 hours.</p>
        <a href="${link}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600">Confirm Account</a>
        <p style="margin:24px 0 0;font-size:12px;color:#72767d">Or copy this link into your browser:<br/>${link}</p>
      </div>
    `
  });
};

export const sendEmailChangeConfirmation = async (newEmail, token) => {
  const link = `${BASE_URL}/confirm-email-change?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to: newEmail,
    subject: 'Confirm your new BetSlate email address',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#202225;color:#dcddde;border-radius:8px">
        <div style="display:flex;align-items:center;margin-bottom:24px">
          <div style="width:36px;height:36px;background:#5865f2;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#fff;font-size:14px;margin-right:12px">BS</div>
          <span style="font-size:20px;font-weight:700;color:#fff">BetSlate AI Automator</span>
        </div>
        <h2 style="color:#fff;margin:0 0 12px">Confirm your new email address</h2>
        <p style="margin:0 0 24px;color:#b9bbbe">Click the button below to confirm <strong style="color:#fff">${newEmail}</strong> as your new email address. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600">Confirm New Email</a>
        <p style="margin:24px 0 0;font-size:12px;color:#72767d">If you didn't request this change, you can safely ignore this email.<br/><br/>Or copy this link into your browser:<br/>${link}</p>
      </div>
    `
  });
};

export const sendPasswordChangedEmail = async (email) => {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Your BetSlate password has been changed',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#202225;color:#dcddde;border-radius:8px">
        <div style="display:flex;align-items:center;margin-bottom:24px">
          <div style="width:36px;height:36px;background:#5865f2;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#fff;font-size:14px;margin-right:12px">BS</div>
          <span style="font-size:20px;font-weight:700;color:#fff">BetSlate AI Automator</span>
        </div>
        <h2 style="color:#fff;margin:0 0 12px">Password changed</h2>
        <p style="margin:0 0 24px;color:#b9bbbe">Your BetSlate account password was just changed. If this was you, no action is needed.</p>
        <p style="margin:0;color:#b9bbbe">If you didn't make this change, reset your password immediately using the link below.</p>
        <br/>
        <a href="${BASE_URL}/forgot-password" style="display:inline-block;background:#ed4245;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600">Reset My Password</a>
      </div>
    `
  });
};

export const sendPasswordResetEmail = async (email, token) => {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your BetSlate password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#202225;color:#dcddde;border-radius:8px">
        <div style="display:flex;align-items:center;margin-bottom:24px">
          <div style="width:36px;height:36px;background:#5865f2;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#fff;font-size:14px;margin-right:12px">BS</div>
          <span style="font-size:20px;font-weight:700;color:#fff">BetSlate AI Automator</span>
        </div>
        <h2 style="color:#fff;margin:0 0 12px">Reset your password</h2>
        <p style="margin:0 0 24px;color:#b9bbbe">Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#5865f2;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600">Reset Password</a>
        <p style="margin:24px 0 0;font-size:12px;color:#72767d">If you didn't request this, you can safely ignore this email.<br/><br/>Or copy this link into your browser:<br/>${link}</p>
      </div>
    `
  });
};
