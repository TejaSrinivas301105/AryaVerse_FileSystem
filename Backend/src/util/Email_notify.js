import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    },
})

export const sendAccessRequestEmail = async (adminEmail, employeeEmail, fileName) => {
    await transporter.sendMail({
        from: process.env.EMAIL,
        to: adminEmail,
        subject: 'New File Access Request',
        html: `<p>Employee <b>${employeeEmail}</b> has requested access to file: <b>${fileName}</b>.</p>
                <p>Please log in to review and approve or reject the request.</p>`,
    })
}

export const sendAccessGrantedEmail = async (employeeEmail, fileName, expiresAt) => {
    await transporter.sendMail({
        from: process.env.EMAIL,
        to: employeeEmail,
        subject: 'File Access Granted',
        html: `<p>Your access to file <b>${fileName}</b> has been approved.</p>
                <p>Access expires at: <b>${new Date(expiresAt).toLocaleString()}</b></p>`,
    })
}

export const sendAccessRejectedEmail = async (employeeEmail, fileName) => {
    await transporter.sendMail({
        from: process.env.EMAIL,
        to: employeeEmail,
        subject: 'File Access Request Rejected',
        html: `<p>Your access request for file <b>${fileName}</b> has been rejected by the admin.</p>`,
    })
}
