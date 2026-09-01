import nodemailer from 'nodemailer'

const emailHost = process.env.EMAIL_HOST
const emailPort = Number(process.env.EMAIL_PORT || 587)
const emailUser = process.env.EMAIL_USER
const emailPass = process.env.EMAIL_PASS

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!emailHost || !emailUser || !emailPass) {
    return {
      sent: false,
      reason: 'Email credentials are not configured.',
    }
  }

  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  })

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || emailUser,
    to: email,
    subject: 'Reset your AgentU password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="margin-bottom: 16px;">Reset your password</h2>
        <p>We received a request to reset your AgentU password.</p>
        <p>Click the link below to choose a new password:</p>
        <p><a href="${resetUrl}" style="color: #111827;">${resetUrl}</a></p>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
    text: `Reset your password: ${resetUrl}`,
  })

  return { sent: true }
}
