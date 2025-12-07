// File: /api/technical-inquiry.js (目录权限修复版)
import { formidable } from 'formidable';
import nodemailer from 'nodemailer';
import os from 'os'; // ✅ 新增：引入系统模块

export const config = {
  api: { bodyParser: false },
};

const getFirstFile = (files, fieldName) => {
  const fileData = files[fieldName];
  if (!fileData) return null;
  if (Array.isArray(fileData)) return fileData[0];
  return fileData;
};

export default async function handler(req, res) {
  console.log('🔹 Step 1: API received request'); // 日志追踪

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  // ✅ 核心修复：显式指定上传目录为系统临时目录
  // 这解决了 Vercel 和 Windows 本地环境的权限冲突
  const form = formidable({
    multiples: false,
    maxFileSize: 10 * 1024 * 1024,
    allowEmptyFiles: true,
    minFileSize: 0,
    uploadDir: os.tmpdir(), // <--- 关键修改
    keepExtensions: true,   // 保留文件后缀
  });

  try {
    console.log('🔹 Step 2: Starting form parsing...');
    
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('❌ Form parse error:', err); // 打印具体错误
          reject(err);
        } else {
          console.log('🔹 Step 3: Form parsed successfully');
          resolve([fields, files]);
        }
      });
    });

    // 变量提取
    const email = fields.email?.[0] || '';
    const rawName = fields.name?.[0] || '';
    // 修复：处理 message 为空的情况
    const messageContent = fields.message?.[0]; 
    const displayMessage = (messageContent && messageContent.trim() !== "") 
      ? messageContent 
      : 'No details provided in the message box.';

    const nameForAutoReply = rawName || 'there';
    const nameForAdminSubject = rawName || 'Applicant';
    const fromNameForAdmin = rawName ? rawName + ' (Website Inquiry)' : 'Website Inquiry';

    // 验证
    if (!email) {
      console.log('⚠️ Error: Email field is missing');
      res.writeHead(302, { Location: '/contact/error.html' });
      res.end();
      return;
    }

    // 邮件配置
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: true,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });

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

    const adminMail = {
      from: `${fromNameForAdmin} <${process.env.FROM_EMAIL}>`,
      to: process.env.FROM_EMAIL,
      replyTo: `${nameForAutoReply} <${email}>`,
      subject: `New Technical Inquiry from ${nameForAdminSubject}`,
      html: `
        <h3>New Inquiry Received</h3>
        <p><strong>Name:</strong> ${rawName || '(Not provided)'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br>${displayMessage}</p>
        <hr>
        <p style="color:gray; font-size:12px;">Sent from Gorgeo Fasteners Website</p>
      `,
      attachments: [],
    };

    // 附件处理
    const fileAttachment = getFirstFile(files, 'file');
    if (fileAttachment && fileAttachment.size > 0) {
      console.log('🔹 Step 4: Attachment found:', fileAttachment.originalFilename);
      const ext = fileAttachment.originalFilename.split('.').pop().toLowerCase();
      // 扩大了允许的文件类型，防止因为类型被拒
      const allowedExts = ['pdf', 'dwg', 'dxf', 'step', 'stp', 'iges', 'igs', 'jpg', 'jpeg', 'png', 'zip', 'rar', '7z'];
      
      if (allowedExts.includes(ext)) {
        adminMail.attachments.push({
          filename: fileAttachment.originalFilename,
          path: fileAttachment.filepath,
        });
      }
    } else {
      console.log('🔹 Step 4: No attachment or empty file');
    }

    console.log('🔹 Step 5: Sending emails...');
    
    // 发送邮件
    await Promise.all([
      transporter.sendMail(adminMail),
      transporter.sendMail({
        from: `${process.env.REPLY_TO_NAME} | Gorgeo Fasteners <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `Confirmation: We've received your inquiry`,
        html: autoReplyBody,
      })
    ]);

    console.log('✅ Step 6: Emails sent! Redirecting...');
    
    // 跳转
    res.writeHead(302, { Location: '/contact/thank-you.html' });
    res.end();

  } catch (err) {
    console.error('❌ Server Crash Error:', err);
    // 这里如果出错，也尝试跳转到错误页，避免白屏
    res.writeHead(302, { Location: '/contact/error.html' });
    res.end();
  }
}