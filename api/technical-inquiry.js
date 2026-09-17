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
    Best regards,<br>
    Catherine Zhang<br>
    GorgeoFasteners
  </div>
`;

// ====== 优化版自动回复 ======
const nameForAutoReply = rawName || 'there';

const autoReplyBody = `
  <div style='font-family: Calibri, sans-serif; font-size: 11pt; color: #333; line-height: 1.6;'>

    <p>Hi ${nameForAutoReply},</p>

    <p>Thanks — we’ve received your inquiry.</p>

    <p>We’ll review the drawing and project information you provided from the manufacturing side, including the critical requirements and any considerations that may affect the proposed manufacturing approach.</p>

    <p>If additional information is needed to continue the review, we’ll contact you about the specific details required.</p>

    <p>You can expect a follow-up from us within one working day (often sooner).</p>

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
        from: `GorgeoFasteners <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `We’ve received your inquiry — GorgeoFasteners`,
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