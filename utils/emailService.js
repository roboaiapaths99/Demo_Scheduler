// Import email functions with error handling
let sendEmail, sendBulkEmails;
try {
  const emailConfig = require('../config/email');
  sendEmail = emailConfig.sendEmail;
  sendBulkEmails = emailConfig.sendBulkEmails;
} catch (error) {
  console.log('Email config not available, using mock functions');
  sendEmail = async (to, subject, html, text) => {
    console.log(`📧 MOCK EMAIL: To: ${to}, Subject: ${subject}`);
    return { success: true, messageId: 'mock-' + Date.now() };
  };
  sendBulkEmails = async (emails) => {
    console.log(`📧 MOCK BULK EMAIL: Sending ${emails.length} emails`);
    return emails.map(email => ({ success: true, messageId: 'mock-' + Date.now() }));
  };
}

class EmailService {
  // Send booking confirmation to client
  static async sendBookingConfirmationToClient(booking, tutor, sales) {
    const subject = 'Demo Session Confirmed - Tutor Availability System';
    
    const html = this.generateBookingConfirmationHTML(booking, tutor, sales, 'client');
    const text = this.generateBookingConfirmationText(booking, tutor, sales, 'client');

    return await sendEmail({
      to: booking.clientEmail,
      subject,
      html,
      text
    });
  }

  // Send booking confirmation to tutor
  static async sendBookingConfirmationToTutor(booking, tutor, sales) {
    const subject = 'New Demo Session Scheduled - Tutor Availability System';
    
    const html = this.generateBookingConfirmationHTML(booking, tutor, sales, 'tutor');
    const text = this.generateBookingConfirmationText(booking, tutor, sales, 'tutor');

    return await sendEmail({
      to: tutor.email,
      subject,
      html,
      text
    });
  }

  // Send booking confirmation to sales
  static async sendBookingConfirmationToSales(booking, tutor, sales) {
    const subject = 'Demo Session Booked Successfully - Tutor Availability System';
    
    const html = this.generateBookingConfirmationHTML(booking, tutor, sales, 'sales');
    const text = this.generateBookingConfirmationText(booking, tutor, sales, 'sales');

    return await sendEmail({
      to: sales.email,
      subject,
      html,
      text
    });
  }

  // Send booking request to tutor
  static async sendBookingRequestToTutor(booking, tutor, sales) {
    const subject = 'New Demo Session Request - Tutor Availability System';
    
    const html = this.generateBookingRequestHTML(booking, tutor, sales);
    const text = this.generateBookingRequestText(booking, tutor, sales);

    return await sendEmail({
      to: tutor.email,
      subject,
      html,
      text
    });
  }

  // Send booking rejection notification
  static async sendBookingRejection(booking, tutor, sales, reason) {
    const emails = [];

    // Send to sales
    emails.push({
      to: sales.email,
      subject: 'Demo Session Rejected - Tutor Availability System',
      html: this.generateBookingRejectionHTML(booking, tutor, sales, reason, 'sales'),
      text: this.generateBookingRejectionText(booking, tutor, sales, reason, 'sales')
    });

    // Send to client if email is available
    if (booking.clientEmail) {
      emails.push({
        to: booking.clientEmail,
        subject: 'Demo Session Update - Tutor Availability System',
        html: this.generateBookingRejectionHTML(booking, tutor, sales, reason, 'client'),
        text: this.generateBookingRejectionText(booking, tutor, sales, reason, 'client')
      });
    }

    return await sendBulkEmails(emails);
  }

  // Send booking cancellation notification
  static async sendBookingCancellation(booking, tutor, sales, reason, cancelledBy) {
    const emails = [];

    // Send to tutor if not cancelled by tutor
    if (cancelledBy.toString() !== tutor._id.toString()) {
      emails.push({
        to: tutor.email,
        subject: 'Demo Session Cancelled - Tutor Availability System',
        html: this.generateBookingCancellationHTML(booking, tutor, sales, reason, cancelledBy, 'tutor'),
        text: this.generateBookingCancellationText(booking, tutor, sales, reason, cancelledBy, 'tutor')
      });
    }

    // Send to sales if not cancelled by sales
    if (cancelledBy.toString() !== sales._id.toString()) {
      emails.push({
        to: sales.email,
        subject: 'Demo Session Cancelled - Tutor Availability System',
        html: this.generateBookingCancellationHTML(booking, tutor, sales, reason, cancelledBy, 'sales'),
        text: this.generateBookingCancellationText(booking, tutor, sales, reason, cancelledBy, 'sales')
      });
    }

    // Send to client if email is available
    if (booking.clientEmail) {
      emails.push({
        to: booking.clientEmail,
        subject: 'Demo Session Cancelled - Tutor Availability System',
        html: this.generateBookingCancellationHTML(booking, tutor, sales, reason, cancelledBy, 'client'),
        text: this.generateBookingCancellationText(booking, tutor, sales, reason, cancelledBy, 'client')
      });
    }

    return await sendBulkEmails(emails);
  }

  // Send reschedule request to sales
  static async sendRescheduleRequest(booking, tutor, sales, rescheduleRequest) {
    const subject = 'Reschedule Request - Tutor Availability System';
    
    const html = this.generateRescheduleRequestHTML(booking, tutor, sales, rescheduleRequest);
    const text = this.generateRescheduleRequestText(booking, tutor, sales, rescheduleRequest);

    return await sendEmail({
      to: sales.email,
      subject,
      html,
      text
    });
  }

  // Send reschedule approval to tutor
  static async sendRescheduleApproval(booking, tutor, sales, rescheduleRequest) {
    const subject = 'Reschedule Approved - Tutor Availability System';
    
    const html = this.generateRescheduleApprovalHTML(booking, tutor, sales, rescheduleRequest);
    const text = this.generateRescheduleApprovalText(booking, tutor, sales, rescheduleRequest);

    return await sendEmail({
      to: tutor.email,
      subject,
      html,
      text
    });
  }

  // Send reschedule rejection to tutor
  static async sendRescheduleRejection(booking, tutor, sales, rescheduleRequest, reason) {
    const subject = 'Reschedule Request Rejected - Tutor Availability System';
    
    const html = this.generateRescheduleRejectionHTML(booking, tutor, sales, rescheduleRequest, reason);
    const text = this.generateRescheduleRejectionText(booking, tutor, sales, rescheduleRequest, reason);

    return await sendEmail({
      to: tutor.email,
      subject,
      html,
      text
    });
  }

  // Send session reminder
  static async sendSessionReminder(booking, tutor, sales, hoursBefore = 1) {
    const emails = [];

    // Send to tutor
    emails.push({
      to: tutor.email,
      subject: `Session Reminder - ${hoursBefore} Hour${hoursBefore > 1 ? 's' : ''} Before`,
      html: this.generateSessionReminderHTML(booking, tutor, sales, hoursBefore, 'tutor'),
      text: this.generateSessionReminderText(booking, tutor, sales, hoursBefore, 'tutor')
    });

    // Send to sales
    emails.push({
      to: sales.email,
      subject: `Session Reminder - ${hoursBefore} Hour${hoursBefore > 1 ? 's' : ''} Before`,
      html: this.generateSessionReminderHTML(booking, tutor, sales, hoursBefore, 'sales'),
      text: this.generateSessionReminderText(booking, tutor, sales, hoursBefore, 'sales')
    });

    // Send to client if email is available
    if (booking.clientEmail) {
      emails.push({
        to: booking.clientEmail,
        subject: `Session Reminder - ${hoursBefore} Hour${hoursBefore > 1 ? 's' : ''} Before`,
        html: this.generateSessionReminderHTML(booking, tutor, sales, hoursBefore, 'client'),
        text: this.generateSessionReminderText(booking, tutor, sales, hoursBefore, 'client')
      });
    }

    return await sendBulkEmails(emails);
  }

  // Send welcome email to new users
  static async sendWelcomeEmail(user) {
    const subject = 'Welcome to Tutor Availability System';
    
    const html = this.generateWelcomeHTML(user);
    const text = this.generateWelcomeText(user);

    return await sendEmail({
      to: user.email,
      subject,
      html,
      text
    });
  }

  // Email template generators
  static generateBookingConfirmationHTML(booking, tutor, sales, recipient) {
    const isClient = recipient === 'client';
    const isTutor = recipient === 'tutor';
    const isSales = recipient === 'sales';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demo Session Confirmed</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; }
        .cta { background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 0.9rem; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1> Demo Session Confirmed! </h1>
        </div>
        <div class="content">
            <p>Dear ${isClient ? booking.clientName : isTutor ? tutor.name : sales.name},</p>
            
            ${isClient ? `
                <p>Your demo session has been successfully confirmed! We're excited to help you get started.</p>
            ` : isTutor ? `
                <p>You have a new demo session scheduled. Please review the details below.</p>
            ` : `
                <p>The demo session has been confirmed. All parties have been notified.</p>
            `}
            
            <div class="booking-details">
                <h3>Session Details</h3>
                <div class="detail-row">
                    <span class="label">Client Name:</span>
                    <span class="value">${booking.clientName}</span>
                </div>
                ${!isClient ? `
                    <div class="detail-row">
                        <span class="label">Client Email:</span>
                        <span class="value">${booking.clientEmail}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Client Phone:</span>
                        <span class="value">${booking.clientPhone}</span>
                    </div>
                ` : ''}
                <div class="detail-row">
                    <span class="label">Date:</span>
                    <span class="value">${new Date(booking.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Time:</span>
                    <span class="value">${booking.startTime} - ${booking.endTime}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Duration:</span>
                    <span class="value">${booking.duration} minutes</span>
                </div>
                <div class="detail-row">
                    <span class="label">Tutor:</span>
                    <span class="value">${tutor.name}</span>
                </div>
                ${!isTutor ? `
                    <div class="detail-row">
                        <span class="label">Sales Representative:</span>
                        <span class="value">${sales.name}</span>
                    </div>
                ` : ''}
            </div>
            
            ${isClient ? `
                <p>Please make sure to:</p>
                <ul>
                    <li>Join the session 5 minutes early</li>
                    <li>Have a stable internet connection</li>
                    <li>Prepare any questions you might have</li>
                </ul>
            ` : ''}
            
            <p>If you need to reschedule or have any questions, please don't hesitate to contact us.</p>
            
            <div class="footer">
                <p>Best regards,<br>Tutor Availability System Team</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  static generateBookingConfirmationText(booking, tutor, sales, recipient) {
    const isClient = recipient === 'client';
    const isTutor = recipient === 'tutor';
    const isSales = recipient === 'sales';

    return `
Demo Session Confirmed

Dear ${isClient ? booking.clientName : isTutor ? tutor.name : sales.name},

${isClient ? 'Your demo session has been successfully confirmed!' : isTutor ? 'You have a new demo session scheduled.' : 'The demo session has been confirmed.'}

Session Details:
- Client: ${booking.clientName}
${!isClient ? `- Email: ${booking.clientEmail}\n- Phone: ${booking.clientPhone}` : ''}
- Date: ${new Date(booking.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Time: ${booking.startTime} - ${booking.endTime}
- Duration: ${booking.duration} minutes
- Tutor: ${tutor.name}
${!isTutor ? `- Sales Representative: ${sales.name}` : ''}

${isClient ? 'Please join the session 5 minutes early and ensure you have a stable internet connection.' : ''}

If you need to reschedule or have any questions, please don't hesitate to contact us.

Best regards,
Tutor Availability System Team
    `;
  }

  static generateBookingRequestHTML(booking, tutor, sales) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Demo Session Request</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffc107; color: #333; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; }
        .actions { margin: 30px 0; }
        .btn { display: inline-block; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .btn-accept { background: #28a745; color: white; }
        .btn-reject { background: #dc3545; color: white; }
        .btn-reschedule { background: #ffc107; color: #333; }
        .footer { text-align: center; color: #666; font-size: 0.9rem; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Demo Session Request</h1>
        </div>
        <div class="content">
            <p>Dear ${tutor.name},</p>
            
            <p>You have a new demo session request from ${sales.name}. Please review the details below and respond at your earliest convenience.</p>
            
            <div class="booking-details">
                <h3>Session Details</h3>
                <div class="detail-row">
                    <span class="label">Client Name:</span>
                    <span class="value">${booking.clientName}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Client Email:</span>
                    <span class="value">${booking.clientEmail}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Client Phone:</span>
                    <span class="value">${booking.clientPhone}</span>
                </div>
                ${booking.clientNotes ? `
                    <div class="detail-row">
                        <span class="label">Client Notes:</span>
                        <span class="value">${booking.clientNotes}</span>
                    </div>
                ` : ''}
                <div class="detail-row">
                    <span class="label">Requested Date:</span>
                    <span class="value">${new Date(booking.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Requested Time:</span>
                    <span class="value">${booking.startTime} - ${booking.endTime}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Duration:</span>
                    <span class="value">${booking.duration} minutes</span>
                </div>
                <div class="detail-row">
                    <span class="label">Sales Representative:</span>
                    <span class="value">${sales.name}</span>
                </div>
            </div>
            
            <div class="actions">
                <p>Please log in to your dashboard to accept, reject, or request a reschedule:</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/pending-bookings" class="btn btn-accept">View Request</a>
            </div>
            
            <p>Your prompt response is greatly appreciated as it helps us provide excellent service to our clients.</p>
            
            <div class="footer">
                <p>Best regards,<br>Tutor Availability System Team</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  static generateBookingRequestText(booking, tutor, sales) {
    return `
New Demo Session Request

Dear ${tutor.name},

You have a new demo session request from ${sales.name}. Please review the details below and respond at your earliest convenience.

Session Details:
- Client: ${booking.clientName}
- Email: ${booking.clientEmail}
- Phone: ${booking.clientPhone}
${booking.clientNotes ? `- Notes: ${booking.clientNotes}` : ''}
- Requested Date: ${new Date(booking.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Requested Time: ${booking.startTime} - ${booking.endTime}
- Duration: ${booking.duration} minutes
- Sales Representative: ${sales.name}

Please log in to your dashboard to accept, reject, or request a reschedule.

Your prompt response is greatly appreciated as it helps us provide excellent service to our clients.

Best regards,
Tutor Availability System Team
    `;
  }

  static generateSessionReminderHTML(booking, tutor, sales, hoursBefore, recipient) {
    const isClient = recipient === 'client';
    const isTutor = recipient === 'tutor';
    const isSales = recipient === 'sales';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Reminder</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ffc107; color: #333; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .reminder-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; }
        .footer { text-align: center; color: #666; font-size: 0.9rem; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Session Reminder</h1>
            <p>Your demo session starts in ${hoursBefore} hour${hoursBefore > 1 ? 's' : ''}!</p>
        </div>
        <div class="content">
            <div class="reminder-box">
                <h3>Upcoming Session</h3>
                <p>This is a friendly reminder about your upcoming demo session.</p>
            </div>
            
            <div class="booking-details">
                <h3>Session Details</h3>
                <div class="detail-row">
                    <span class="label">Client:</span>
                    <span class="value">${booking.clientName}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Date:</span>
                    <span class="value">${new Date(booking.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Time:</span>
                    <span class="value">${booking.startTime} - ${booking.endTime}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Duration:</span>
                    <span class="value">${booking.duration} minutes</span>
                </div>
                ${isClient ? `
                    <div class="detail-row">
                        <span class="label">Tutor:</span>
                        <span class="value">${tutor.name}</span>
                    </div>
                ` : ''}
                ${isTutor ? `
                    <div class="detail-row">
                        <span class="label">Client:</span>
                        <span class="value">${booking.clientName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Client Email:</span>
                        <span class="value">${booking.clientEmail}</span>
                    </div>
                ` : ''}
            </div>
            
            ${isClient ? `
                <h3>Preparation Tips:</h3>
                <ul>
                    <li>Test your internet connection</li>
                    <li>Check your audio/video setup</li>
                    <li>Have your questions ready</li>
                    <li>Join the session 5 minutes early</li>
                </ul>
            ` : isTutor ? `
                <h3>Preparation Tips:</h3>
                <ul>
                    <li>Review client information and notes</li>
                    <li>Prepare your presentation materials</li>
                    <li>Test your equipment</li>
                    <li>Be ready 5 minutes before start time</li>
                </ul>
            ` : `
                <h3>Follow-up Actions:</h3>
                <ul>
                    <li>Ensure both parties are prepared</li>
                    <li>Be available for any last-minute questions</li>
                    <li>Monitor session attendance</li>
                </ul>
            `}
            
            <div class="footer">
                <p>Best regards,<br>Tutor Availability System Team</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  static generateSessionReminderText(booking, tutor, sales, hoursBefore, recipient) {
    const isClient = recipient === 'client';
    const isTutor = recipient === 'tutor';
    const isSales = recipient === 'sales';

    return `
Session Reminder

Your demo session starts in ${hoursBefore} hour${hoursBefore > 1 ? 's' : ''}!

Session Details:
- Client: ${booking.clientName}
- Date: ${new Date(booking.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Time: ${booking.startTime} - ${booking.endTime}
- Duration: ${booking.duration} minutes
${isClient ? `- Tutor: ${tutor.name}` : ''}
${isTutor ? `- Client: ${booking.clientName}\n- Client Email: ${booking.clientEmail}` : ''}

${isClient ? `Preparation Tips:
- Test your internet connection
- Check your audio/video setup
- Have your questions ready
- Join the session 5 minutes early` : isTutor ? `Preparation Tips:
- Review client information and notes
- Prepare your presentation materials
- Test your equipment
- Be ready 5 minutes before start time` : `Follow-up Actions:
- Ensure both parties are prepared
- Be available for any last-minute questions
- Monitor session attendance`}

Best regards,
Tutor Availability System Team
    `;
  }

  static generateWelcomeHTML(user) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Tutor Availability System</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .welcome-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .btn { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 0.9rem; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Tutor Availability System!</h1>
        </div>
        <div class="content">
            <p>Dear ${user.name},</p>
            
            <p>Welcome to the Tutor Availability System! We're excited to have you on board.</p>
            
            <div class="welcome-box">
                <h3>Your Account Details:</h3>
                <p><strong>Name:</strong> ${user.name}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Role:</strong> ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
            </div>
            
            <p>What you can do:</p>
            <ul>
                ${user.role === 'tutor' ? `
                    <li>Manage your availability schedule</li>
                    <li>Respond to booking requests</li>
                    <li>View your upcoming sessions</li>
                ` : user.role === 'sales' ? `
                    <li>View available tutor slots</li>
                    <li>Book demo sessions for clients</li>
                    <li>Manage your bookings</li>
                ` : `
                    <li>Manage system settings</li>
                    <li>View analytics and reports</li>
                    <li>Oversee all activities</li>
                `}
                <li>Receive notifications for important updates</li>
            </ul>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/login.html" class="btn">Get Started</a>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            
            <div class="footer">
                <p>Best regards,<br>Tutor Availability System Team</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  static generateWelcomeText(user) {
    return `
Welcome to Tutor Availability System

Dear ${user.name},

Welcome to the Tutor Availability System! We're excited to have you on board.

Your Account Details:
- Name: ${user.name}
- Email: ${user.email}
- Role: ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}

What you can do:
${user.role === 'tutor' ? '- Manage your availability schedule\n- Respond to booking requests\n- View your upcoming sessions' : user.role === 'sales' ? '- View available tutor slots\n- Book demo sessions for clients\n- Manage your bookings' : '- Manage system settings\n- View analytics and reports\n- Oversee all activities'}
- Receive notifications for important updates

Get started here: ${process.env.FRONTEND_URL || 'http://localhost:5000'}/login.html

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
Tutor Availability System Team
    `;
  }

  // Placeholder methods for other email types
  static generateBookingRejectionHTML(booking, tutor, sales, reason, recipient) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Update</title>
</head>
<body>
    <p>Booking has been rejected. Reason: ${reason}</p>
</body>
</html>
    `;
  }

  static generateBookingRejectionText(booking, tutor, sales, reason, recipient) {
    return `Booking has been rejected. Reason: ${reason}`;
  }

  static generateBookingCancellationHTML(booking, tutor, sales, reason, cancelledBy, recipient) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Cancelled</title>
</head>
<body>
    <p>Booking has been cancelled. Reason: ${reason}</p>
</body>
</html>
    `;
  }

  static generateBookingCancellationText(booking, tutor, sales, reason, cancelledBy, recipient) {
    return `Booking has been cancelled. Reason: ${reason}`;
  }

  static generateRescheduleRequestHTML(booking, tutor, sales, rescheduleRequest) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reschedule Request</title>
</head>
<body>
    <p>Reschedule request received for booking ${booking._id}</p>
</body>
</html>
    `;
  }

  static generateRescheduleRequestText(booking, tutor, sales, rescheduleRequest) {
    return `Reschedule request received for booking ${booking._id}`;
  }

  static generateRescheduleApprovalHTML(booking, tutor, sales, rescheduleRequest) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reschedule Approved</title>
</head>
<body>
    <p>Your reschedule request has been approved.</p>
</body>
</html>
    `;
  }

  static generateRescheduleApprovalText(booking, tutor, sales, rescheduleRequest) {
    return `Your reschedule request has been approved.`;
  }

  static generateRescheduleRejectionHTML(booking, tutor, sales, rescheduleRequest, reason) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reschedule Rejected</title>
</head>
<body>
    <p>Your reschedule request has been rejected. Reason: ${reason}</p>
</body>
</html>
    `;
  }

  static generateRescheduleRejectionText(booking, tutor, sales, rescheduleRequest, reason) {
    return `Your reschedule request has been rejected. Reason: ${reason}`;
  }

  // Send daily summary to admin
  static async sendDailySummary(admin, stats, date) {
    const subject = `Daily Summary - ${date.toLocaleDateString()}`;
    
    const html = this.generateDailySummaryHTML(admin, stats, date);
    const text = this.generateDailySummaryText(admin, stats, date);

    return await sendEmail({
      to: admin.email,
      subject,
      html,
      text
    });
  }

  // Send weekly summary to admin
  static async sendWeeklySummary(admin, stats, weekStart) {
    const subject = `Weekly Summary - Week of ${weekStart.toLocaleDateString()}`;
    
    const html = this.generateWeeklySummaryHTML(admin, stats, weekStart);
    const text = this.generateWeeklySummaryText(admin, stats, weekStart);

    return await sendEmail({
      to: admin.email,
      subject,
      html,
      text
    });
  }

  static generateDailySummaryHTML(admin, stats, date) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Summary</title>
</head>
<body>
    <h2>Daily Summary for ${date.toLocaleDateString()}</h2>
    <ul>
        <li>Total Bookings: ${stats.totalBookings}</li>
        <li>Confirmed Bookings: ${stats.confirmedBookings}</li>
        <li>Cancelled Bookings: ${stats.cancelledBookings}</li>
        <li>New Users: ${stats.newUsers}</li>
        <li>Active Tutors: ${stats.activeTutors}</li>
        <li>Active Sales: ${stats.activeSales}</li>
    </ul>
</body>
</html>
    `;
  }

  static generateDailySummaryText(admin, stats, date) {
    return `
Daily Summary for ${date.toLocaleDateString()}

- Total Bookings: ${stats.totalBookings}
- Confirmed Bookings: ${stats.confirmedBookings}
- Cancelled Bookings: ${stats.cancelledBookings}
- New Users: ${stats.newUsers}
- Active Tutors: ${stats.activeTutors}
- Active Sales: ${stats.activeSales}
    `;
  }

  static generateWeeklySummaryHTML(admin, stats, weekStart) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Summary</title>
</head>
<body>
    <h2>Weekly Summary for Week of ${weekStart.toLocaleDateString()}</h2>
    <ul>
        <li>Total Bookings: ${stats.totalBookings}</li>
        <li>Confirmed Bookings: ${stats.confirmedBookings}</li>
        <li>Cancelled Bookings: ${stats.cancelledBookings}</li>
        <li>New Users: ${stats.newUsers}</li>
    </ul>
</body>
</html>
    `;
  }

  static generateWeeklySummaryText(admin, stats, weekStart) {
    return `
Weekly Summary for Week of ${weekStart.toLocaleDateString()}

- Total Bookings: ${stats.totalBookings}
- Confirmed Bookings: ${stats.confirmedBookings}
- Cancelled Bookings: ${stats.cancelledBookings}
- New Users: ${stats.newUsers}
    `;
  }
}

module.exports = EmailService;
