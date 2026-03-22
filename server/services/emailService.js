import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const sendVerificationEmail = async (email, token) => {
  const link = `${BASE_URL}/verify-email?token=${token}`;
  await resend.emails.send({
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

export const sendPasswordResetEmail = async (email, token) => {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  await resend.emails.send({
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
