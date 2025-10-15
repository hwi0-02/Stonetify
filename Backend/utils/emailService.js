const nodemailer = require('nodemailer');
const { logger } = require('./logger');

// Gmail SMTP를 사용해 재사용 가능한 트랜스포터를 생성한다
// Gmail 계정에서 2단계 인증을 활성화하고 앱 비밀번호를 발급해야 한다
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

transporter.verify((error) => {
  if (error) {
    logger.error('SMTP connection failed', { error: error.message });
  } else {
    logger.info('SMTP connection established');
  }
});

/**
 * 일반 텍스트/HTML 이메일 전송
 * @param {Object} options
 * @param {string} options.to 수신자 이메일
 * @param {string} options.subject 제목
 * @param {string} options.text 텍스트 본문
 * @param {string} [options.html] HTML 본문 (선택)
 * @returns {Promise<void>}
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to) throw new Error('수신자 이메일(to)이 필요합니다.');

  const mailOptions = {
    from: `Stonetify <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html: html || `<pre>${text}</pre>`
  };

  const info = await transporter.sendMail(mailOptions);
  logger.debug('Email sent', { messageId: info.messageId, to });
}

/**
 * 비밀번호 재설정 코드 이메일 전송
 * @param {string} to 수신자 이메일
 * @param {string} code 인증 코드
 */
async function sendPasswordResetCode(to, code) {
  const subject = 'Stonetify 비밀번호 재설정 코드';
  const text = `다음 코드를 앱에 입력하여 비밀번호 재설정을 진행하세요.\n\n코드: ${code}\n\n이 코드는 10분 후 만료됩니다.`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;">
      <h2 style="color:#6c4ef7;">Stonetify 비밀번호 재설정</h2>
      <p>아래 <strong>인증 코드</strong>를 앱에 입력하여 비밀번호 재설정을 진행해 주세요.</p>
      <div style="font-size:24px;font-weight:bold;letter-spacing:4px;padding:12px 20px;border:2px dashed #6c4ef7;display:inline-block;margin:16px 0;">
        ${code}
      </div>
      <p style="font-size:12px;color:#666;">이 코드는 10분 후 만료됩니다. 본인이 요청한 것이 아니라면 이 이메일을 무시하세요.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:12px;color:#999;">© ${new Date().getFullYear()} Stonetify</p>
    </div>
  `;
  await sendEmail({ to, subject, text, html });
}

module.exports = {
  sendEmail,
  sendPasswordResetCode,
};
