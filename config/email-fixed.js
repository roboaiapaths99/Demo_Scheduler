// Email configuration (mock implementation to avoid nodemailer dependency)
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  fromName: process.env.EMAIL_FROM_NAME || 'Tutor Availability System',
  fromEmail: process.env.EMAIL_FROM_EMAIL || process.env.EMAIL_USER
};

// Mock email functions to avoid nodemailer dependency
const sendEmail = async (to, subject, html, text) => {
  console.log(`📧 MOCK EMAIL: To: ${to}, Subject: ${subject}`);
  console.log(`📧 Email content preview: ${text ? text.substring(0, 100) + '...' : 'HTML content'}`);
  
  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return { success: true, messageId: 'mock-' + Date.now() };
};

const sendBulkEmails = async (emails) => {
  console.log(`📧 MOCK BULK EMAIL: Sending ${emails.length} emails`);
  
  const results = await Promise.all(
    emails.map(email => sendEmail(email.to, email.subject, email.html, email.text))
  );
  
  return results;
};

const verifyEmailConfig = async () => {
  console.log('📧 MOCK EMAIL: Configuration verified (mock)');
  return true;
};

module.exports = {
  emailConfig,
  sendEmail,
  sendBulkEmails,
  verifyEmailConfig
};
