// File: /api/technical-inquiry.js
import { formidable } from 'formidable';
import nodemailer from 'nodemailer';
import os from 'os';

export const config = {
  api: { bodyParser: false },
};

// ====== IP 限频（轻量版）======
const ipRequestMap = new Map();

// ====== 工具函数 ======
const getFirstFile = (files, fieldName) => {
  const fileData = files[fieldName];
  if (!fileData) return null;
  if (Array.isArray(fileData)) return fileData[0];
  return fileData;
};

export default async function handler(req, res) {
  // ====== 方法校验 ======
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // ====== IP 解析（只能在 handler 内）======
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress;

  // ====== IP 限频：1 分钟 1 次 ======
  const now = Date.now();
  const lastTime = ipRequestMap.get(ip);

  if (lastTime && now - lastTime < 60 * 1000) {
    res.status(200).end('OK');
    return;
  }

  ipRequestMap.set(ip, now);

  // ====== formidable 配置 ======
  const form = formidable({
    multiples: false,
    maxFileSize: 10 * 1024 * 1024,
    allowEmptyFiles: true,
    minFileSize: 0,
    uploadDir: os.tmpdir(),
    keepExtensions: true,
  });

  try {
    // ====== 解析表单 ======
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // ====== 蜜罐反 bot ======
    const honeypot = fields.company_website?.[0];
    if (honeypot && String(honeypot).trim() !== '') {
      res.status(200).end('OK');
      return;
    }

    // ====== 字段提取 ======
    const email = fields.email?.[0] || '';
    const rawName = fields.name?.[0] || '';
    const messageContent = fields.message?.[0] || '';

    // ====== 乱码随机串拦截 ======
    const msg = messageContent.trim();
    if (
      msg &&
      msg.length >= 18 &&
      !msg.includes(' ') &&
      /^[a-zA-Z]+$/.test(msg)
    ) {
      res.status(200).end('OK');
      return;
    }

    if (!email) {
      res.writeHead(302, { Location: '/contact/error.html' });
      res.end();
      return;
    }

    // ====== 邮件配置 ======
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: true,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const displayMessage =
      msg !== '' ? msg : 'No details provided in the message box.';

    // ====== 原样保留的签名 ======
    const signature = `
      <div style="margin-top: 25px; font-family: Calibri, sans-serif; color: #333; line-height: 1.4;">
        Best regards,<br>
        <strong style="font-size: 1.1em; color: #000;">Catherine Zhang</strong><br>
        <span style="color: #f97316; font-weight: 600;">Technical Review & Small-Batch Machining Support</span><br>
        <span>Gorgeo Fasteners — Overflow Support for Machine Shops</span><br>
        <span style="font-size: 12px; color: #666;">Pins · Shafts · Sleeves · Spacers</span><br>
        <br>
        <span style="font-size: 12px; color: #888;">📱 +86 137 2457 5413 (WhatsApp)</span><br>
        <span style="font-size: 12px; color: #888;">⏱ UTC+8 — Reply within 24 hours</span>
      </div>
    `;

    // ====== 原样保留的自动回复内容 ======
    const nameForAutoReply = rawName || 'there';

    const autoReplyBody = `
      <div style='font-family: Calibri, sans-serif; font-size: 11pt; color: #333; line-height: 1.6;'>
        <p>Hi ${nameForAutoReply},</p>
        <p><strong>Confirmed — your inquiry and file(s) have been received successfully.</strong></p>
        <p>I’ll review the part personally. Within <strong>24 hours on working days</strong> (often sooner), you’ll receive a reply covering:</p>
        <ul style="background-color: #f9f9f9; padding: 12px 20px; border-left: 3px solid #f97316; list-style-type: none; margin: 15px 0;">
          <li style="margin-bottom: 5px;">• Any tolerance / fit risks (H7, g6, clearance logic)</li>
          <li style="margin-bottom: 5px;">• Material & batch feasibility</li>
          <li style="margin-bottom: 5px;">• Potential cost drivers — and practical ways to reduce them</li>
          <li>• Suggestions if something may cause assembly jams or tooling issues</li>
        </ul>
        <p>If anything is unclear in the drawing, I’ll reach out before quoting — <strong>it's always better to prevent problems than to price them in.</strong></p>
        <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>
        <p style="font-size: 0.9em; color: #555;">
          <em>If you'd like to add more context while waiting, feel free to reply with:</em><br>
          <em>• Material preference</em><br>
          <em>• Quantity range</em><br>
          <em>• What’s currently blocking your schedule on this part</em>
        </p>
        ${signature}
      </div>
    `;

    // ====== 管理员邮件 ======
    const adminMail = {
      from: `Website Inquiry <${process.env.FROM_EMAIL}>`,
      to: process.env.FROM_EMAIL,
      replyTo: `${nameForAutoReply} <${email}>`,
      subject: 'New Technical Inquiry',
      html: `
        <h3>New Inquiry Received</h3>
        <p><strong>Name:</strong> ${rawName || '(Not provided)'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br>${displayMessage}</p>
      `,
      attachments: [],
    };

    // ====== 附件 ======
    const fileAttachment = getFirstFile(files, 'file');
    if (fileAttachment && fileAttachment.size > 0) {
      adminMail.attachments.push({
        filename: fileAttachment.originalFilename,
        path: fileAttachment.filepath,
      });
    }

    // ====== 发送邮件 ======
    await Promise.all([
      transporter.sendMail(adminMail),
      transporter.sendMail({
        from: `Gorgeo Fasteners <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `Confirmation: We've received your inquiry`,
        html: autoReplyBody,
      }),
    ]);

    // ====== 成功跳转 ======
    res.writeHead(302, { Location: '/contact/thank-you.html' });
    res.end();

  } catch (err) {
    console.error(err);
    res.writeHead(302, { Location: '/contact/error.html' });
    res.end();
  }
}
