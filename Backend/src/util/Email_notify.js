import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.larksuite.com'
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_SECURE = (process.env.SMTP_SECURE || (SMTP_PORT === 465 ? 'true' : 'false')).toLowerCase() === 'true'
const SMTP_USER = process.env.EMAIL
const SMTP_PASS = process.env.PASSWORD
const FROM_EMAIL = process.env.EMAIL_FROM || SMTP_USER

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
})

export const sendAccessRequestEmail = async (adminEmail, employeeEmail, fileName) => {
    await transporter.sendMail({
        from: FROM_EMAIL,
        to: adminEmail,
        subject: 'New File Access Request',
        html: `<p>Employee <b>${employeeEmail}</b> has requested access to file: <b>${fileName}</b>.</p>
                <p>Please log in to review and approve or reject the request.</p>`,
    })
}

export const sendAccessGrantedEmail = async (employeeEmail, fileName, expiresAt) => {
    await transporter.sendMail({
    from: FROM_EMAIL,
        to: employeeEmail,
        subject: 'File Access Granted',
        html: `<p>Your access to file <b>${fileName}</b> has been approved.</p>
                <p>Access expires at: <b>${new Date(expiresAt).toLocaleString()}</b></p>`,
    })
}

export const sendAccessRejectedEmail = async (employeeEmail, fileName) => {
    await transporter.sendMail({
        from: FROM_EMAIL,
        to: employeeEmail,
        subject: 'File Access Request Rejected',
        html: `<p>Your access request for file <b>${fileName}</b> has been rejected by the admin.</p>`,
    })
}
