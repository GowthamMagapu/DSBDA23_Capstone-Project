import nodemailer from 'nodemailer'

const emailHost = process.env.EMAIL_HOST
const emailPort = Number(process.env.EMAIL_PORT || 587)
const emailUser = process.env.EMAIL_USER
const emailPass = process.env.EMAIL_PASS

export type SendEmailResult = { sent: true } | { sent: false; reason: string }

export function isEmailConfigured() {
  return Boolean(emailHost && emailUser && emailPass)
}

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  })
  return transporter
}

export async function sendEmail(message: { to: string; subject: string; html: string; text: string }): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'Email credentials are not configured.' }
  }

  try {
    await getTransporter().sendMail({ from: process.env.EMAIL_FROM || emailUser, ...message })
    return { sent: true }
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Unknown email error' }
  }
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  return sendEmail({
    to: email,
    subject: 'Reset your AgentU password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 16px;">Reset your password</h2>
        <p>We received a request to reset your AgentU password.</p>
        <p>Click the link below to choose a new password:</p>
        <p><a href="${escapeHtml(resetUrl)}" style="color: #111827;">${escapeHtml(resetUrl)}</a></p>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
    text: `Reset your password: ${resetUrl}`,
  })
}
