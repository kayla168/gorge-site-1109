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

// ====== 所有被拦情况统一跳成功页 ======
const redirectSuccess = (res) => {
  res.writeHead(302, { Location: '/contact/thank-you.html' });
  res.end();
};

export default async function handler(req, res) {
  // ====== 方法校验 ======
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // ====== IP 解析（必须在 handler 内）======
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress;

  // ====== IP 限频：1 分钟 1 次 ======
  const now = Date.now();
  const lastTime = ipRequestMap.get(ip);

  if (lastTime && now - lastTime < 60 * 1000) {
    redirectSuccess(res);
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
      redirectSuccess(res);
      return;
    }

    // ====== 字段提取 ======
    const email = fields.email?.[0] || '';
    const rawName = fields.name?.[0] || '';
    const messageContent = fields.message?.[0] || '';

    const msg = messageContent.trim();

    // ====== 随机串垃圾 ======
    if (
      msg &&
      msg.length >= 18 &&
      !msg.includes(' ') &&
      /^[a-zA-Z]+$/.test(msg)
    ) {
      redirectSuccess(res);
      return;
    }

    // ====== URL 广告垃圾（只拦“无附件 + 有链接”）=====
    const fileAttachment = getFirstFile(files, 'file');
    const hasFile = !!(fileAttachment && fileAttachment.size > 0);

    if (!hasFile && /(https?:\/\/|www\.)/i.test(msg)) {
      redirectSuccess(res);
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

   
// ====== 优化版签名（工程收敛版） ======
const signature = `
  <div style="margin-top: 25px; font-family: Calibri, sans-serif; color: #333; line-height: 1.4;">

    <div style="margin-bottom: 8px;">
      Best regards,<br>
      <strong style="font-size: 1.1em; color: #000;">Catherine Zhang</strong>
    </div>

    <div style="margin-bottom: 10px;">
      <span style="color: #f97316; font-weight: 600;">
        Custom Fasteners & Precision Machined Components
      </span><br>
      <span style="font-size: 12px; color: #666;">
       OEM · Low-Volume Production · Engineering Components
      </span>
    </div>

    <div style="margin-bottom: 10px;">
      Gorgeo Fasteners
    </div>

    <div style="font-size: 12px; color: #888; margin-bottom: 4px;">
      📱 +86 137 2457 5413 (WhatsApp)
    </div>

   

  </div>
`;

// ====== 优化版自动回复 ======
const nameForAutoReply = rawName || 'there';

const autoReplyBody = `
  <div style='font-family: Calibri, sans-serif; font-size: 11pt; color: #333; line-height: 1.6;'>

    <p>Hi ${nameForAutoReply},</p>

    <p><strong>Thanks — we’ve received your inquiry and file(s).</strong></p>

    <p>
      Our engineering team will review your requirements and respond with a practical next step within
      <strong>one working day</strong> (often sooner).
    </p>

    <p>
      We focus on manufacturability, fit, and key technical details required for stable production and installation.
    </p>

    <p><strong>Typical output includes:</strong></p>

    <ul style="background-color:#f9f9f9; padding:12px 20px; border-left:3px solid #f97316; list-style:none; margin:15px 0;">
      <li style="margin-bottom:6px;">• DFM feedback where manufacturability risks are identified</li>
      <li style="margin-bottom:6px;">• Material or process recommendations (if applicable)</li>
      <li style="margin-bottom:6px;">• Production feasibility and lead time estimate</li>
      <li>• Any critical clarification required before production</li>
    </ul>

    <p>
      If anything is unclear, we’ll respond with the minimum required clarification — usually a marked-up drawing or a short technical note.
    </p>

    <p>
      If you’d like to add context while we review, you can simply reply with:
    </p>

    <p style="margin: 10px 0;">
      • Estimated quantity or annual usage<br>
      • Application / where the part is used<br>
      • Any fit, vibration, or installation concerns
    </p>

    <hr style='border:none; border-top:1px solid #eee; margin:20px 0;'>

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

    if (hasFile) {
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
        subject: `We’ve received your file — Gorgeo Fasteners`,
        html: autoReplyBody,
      }),
    ]);

    // ====== 成功跳转 ======
    redirectSuccess(res);

  } catch (err) {
    console.error(err);
    res.writeHead(302, { Location: '/contact/error.html' });
    res.end();
  }
}