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

    // ====== 修正版签名 ======
    const signature = `
      <div style="margin-top: 25px; font-family: Calibri, sans-serif; color: #333; line-height: 1.4;">
        Best regards,<br>
        <strong style="font-size: 1.1em; color: #000;">Catherine Zhang</strong><br>
        <span style="color: #f97316; font-weight: 600;">Low-Volume Custom Fasteners for Parts Washer OEMs</span><br>
        <span>Gorgeo Fasteners — Support for Maintenance, Assembly & Re-installation Parts</span><br>
        <span style="font-size: 12px; color: #666;">Pins · Screws · Sleeves · Spacers</span><br>
        <br>
        <span style="font-size: 12px; color: #888;">📱 +86 137 2457 5413 (WhatsApp)</span><br>
        <span style="font-size: 12px; color: #888;">⏱ UTC+8 — Reply within one working day</span>
      </div>
    `;

    // ====== 修正版自动回复 ======
    const nameForAutoReply = rawName || 'there';

    const autoReplyBody = `
      <div style='font-family: Calibri, sans-serif; font-size: 11pt; color: #333; line-height: 1.6;'>
        <p>Hi ${nameForAutoReply},</p>

        <p><strong>Thanks — we’ve received your inquiry and file(s).</strong></p>

        <p>
          We’ll review what you sent and come back with a practical next step within
          <strong>one working day</strong> (often sooner).
        </p>

        <p>
          We usually start by checking what is already clear, then confirm any fit,
          manufacturability or re-installation details only if they are important to move the part forward.
        </p>

        <p>Our reply will usually include:</p>

        <ul style="background-color: #f9f9f9; padding: 12px 20px; border-left: 3px solid #f97316; list-style-type: none; margin: 15px 0;">
          <li style="margin-bottom: 5px;">• Whether the part is suitable for low-volume production</li>
          <li style="margin-bottom: 5px;">• Practical material or batch-size suggestions (if needed)</li>
          <li style="margin-bottom: 5px;">• A realistic lead time and the most workable next step</li>
          <li>• Any detail worth confirming before production, if something is still unclear</li>
        </ul>

        <p>
          If more information would help, we’ll keep the follow-up simple.
          A marked-up photo, one extra screenshot, or one fit note is often enough.
        </p>

        <p>
          We usually support OEM teams with low-volume custom fasteners and installation parts
          when standard hardware is not the best fit, maintenance access is awkward,
          or repeated re-installation needs a more reliable solution.
        </p>

        <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;'>

        <p style="font-size: 0.9em; color: #555;">
          <em>If you want to add context while waiting, you can simply reply with:</em><br>
          <em>• Estimated quantity or annual usage (if known)</em><br>
          <em>• Where the part is used on the machine</em><br>
          <em>• Any fit, looseness, vibration or re-installation issue you’ve seen</em>
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