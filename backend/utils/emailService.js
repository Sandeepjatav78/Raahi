// Email configuration — credentials MUST be in environment variables
// Uses Brevo (formerly Sendinblue) HTTP API — SMTP is blocked on Render free tier
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_USER = process.env.EMAIL_USER; // verified sender email in Brevo

if (!BREVO_API_KEY || !EMAIL_USER) {
  console.warn('⚠️  BREVO_API_KEY and EMAIL_USER env vars not set — emails will not be sent');
} else {
  console.log('✅ Email service ready (Brevo HTTP API)');
}

/**
 * Send an email via Brevo HTTP API (uses native fetch — port 443, works everywhere)
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.toName - Recipient name
 * @param {string} options.subject - Subject line
 * @param {string} options.html - HTML body
 * @param {string} [options.fromName='TrackMate Team'] - Sender display name
 * @returns {Promise<boolean>}
 */
const sendEmail = async ({ to, toName, subject, html, fromName = 'TrackMate Team' }) => {
  if (!BREVO_API_KEY || !EMAIL_USER) {
    console.warn('⚠️ Email not configured — skipping email');
    return false;
  }

  // Retry up to 3 times on transient network errors
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: fromName, email: EMAIL_USER },
          to: [{ email: to, name: toName || to }],
          subject,
          htmlContent: html
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (res.ok) return true;

      const body = await res.text();
      console.error(`Email send failed (attempt ${i + 1}/3): Brevo API ${res.status}: ${body}`);
      return false; // API errors (4xx/5xx) are not retryable
    } catch (err) {
      if (i === 2) {
        console.error(`Email send failed (attempt ${i + 1}/3):`, err.message);
        return false;
      }
      console.warn(`Email send retry ${i + 1}/3 (${err.message}) — waiting ${(i + 1)}s...`);
      await new Promise(r => setTimeout(r, (i + 1) * 1000));
    }
  }
  return false;
};

/**
 * Send welcome email to new student
 * @param {Object} params - Email parameters
 * @param {string} params.email - Student email address
 * @param {string} params.fullName - Student full name
 * @param {string} params.username - Student username/roll number
 * @param {string} params.busNumber - Assigned bus number
 * @param {string} params.routeName - Route name
 * @param {string} params.stopName - Boarding stop name
 * @returns {Promise<boolean>} Success status
 */
const sendWelcomeEmail = async ({ email, fullName, username, busNumber, routeName, stopName }) => {
  try {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TrackMate</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#F57C00 0%,#FF9800 50%,#FFB74D 100%);border-radius:12px 12px 0 0;padding:36px 32px;text-align:center;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td align="center">
              <img src="https://trackmaterce.onrender.com/email-logo.png" alt="TrackMate" width="56" height="56" style="display:block;margin:0 auto;border-radius:14px;" />
            </td></tr>
            <tr><td align="center" style="padding-top:14px;">
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;">TrackMate</h1>
              <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.9);font-weight:400;">Smart Bus Tracking System</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#FFFFFF;padding:36px 32px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Greeting -->
          <h2 style="margin:0 0 6px;font-size:22px;font-weight:600;color:#2D2D2D;">Hi ${fullName} &#128075;</h2>
          <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#F57C00;">Welcome to TrackMate</p>
          <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">Your smart commute companion is ready. Your account has been created and you can now track your assigned bus in real time.</p>

          <!-- Account Details Card -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF8F0;border:1px solid #FFE0B2;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td style="font-size:15px;font-weight:700;color:#E65100;padding-bottom:14px;">
                  &#128203;&nbsp; Account Details
                </td></tr>
                <tr><td>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#444;">
                    <tr>
                      <td style="padding:7px 0;font-weight:600;color:#795548;width:160px;">Roll Number</td>
                      <td style="padding:7px 0;">${username}</td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;font-weight:600;color:#795548;border-top:1px solid #FFE0B2;">Assigned Bus</td>
                      <td style="padding:7px 0;border-top:1px solid #FFE0B2;">${busNumber || 'Not assigned yet'}</td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;font-weight:600;color:#795548;border-top:1px solid #FFE0B2;">Route</td>
                      <td style="padding:7px 0;border-top:1px solid #FFE0B2;">${routeName || 'Not assigned yet'}</td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;font-weight:600;color:#795548;border-top:1px solid #FFE0B2;">Boarding Stop</td>
                      <td style="padding:7px 0;border-top:1px solid #FFE0B2;">${stopName || 'Not assigned yet'}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>
          </table>

          <!-- Getting Started -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAFAFA;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#E65100;">&#128640;&nbsp; Getting Started</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#444;line-height:1.7;">
                <tr><td style="padding:5px 0;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:#F57C00;color:#fff;border-radius:50%;font-size:12px;font-weight:700;margin-right:10px;">&#10003;</span>Log in using your roll number as the initial password</td></tr>
                <tr><td style="padding:5px 0;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:#F57C00;color:#fff;border-radius:50%;font-size:12px;font-weight:700;margin-right:10px;">&#10003;</span>Change your password after first login</td></tr>
                <tr><td style="padding:5px 0;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:#F57C00;color:#fff;border-radius:50%;font-size:12px;font-weight:700;margin-right:10px;">&#10003;</span>Track your bus live and view ETA</td></tr>
                <tr><td style="padding:5px 0;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:#F57C00;color:#fff;border-radius:50%;font-size:12px;font-weight:700;margin-right:10px;">&#10003;</span>Enable notifications for arrival alerts</td></tr>
              </table>
            </td></tr>
          </table>

          <!-- Security Warning -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF3E0;border-left:4px solid #F57C00;border-radius:0 10px 10px 0;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#E65100;">&#128274;&nbsp; Security Reminder</p>
              <p style="margin:0;font-size:13px;color:#6D4C00;line-height:1.5;">Please change your password immediately after logging in. Your initial password is your roll number (<strong>${username}</strong>).</p>
            </td></tr>
          </table>

          <!-- Help -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAFAFA;border-radius:10px;margin-bottom:28px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#888;">&#10067;&nbsp; Need Help?</p>
              <p style="margin:0;font-size:13px;color:#777;line-height:1.5;">If your details are incorrect or you face any issues, contact the TrackMate administrator.</p>
            </td></tr>
          </table>

          <!-- CTA Button -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td align="center" style="padding-bottom:8px;">
              <a href="https://trackmaterce.onrender.com/" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#F57C00,#FF9800);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 36px;border-radius:8px;box-shadow:0 3px 10px rgba(245,124,0,0.3);">Open TrackMate</a>
            </td></tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 32px;text-align:center;">
          <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#888;">TrackMate Team</p>
          <p style="margin:0 0 14px;font-size:12px;color:#AAA;">Smart Campus Transportation System</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
            <tr>
              <td style="padding:0 8px;"><a href="https://trackmaterce.onrender.com/" style="font-size:12px;color:#F57C00;text-decoration:none;">Dashboard</a></td>
              <td style="color:#DDD;font-size:12px;">|</td>
              <td style="padding:0 8px;"><a href="https://maganti-praveen.github.io/TrackMate/" style="font-size:12px;color:#F57C00;text-decoration:none;">Website</a></td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#BBB;">You received this email because an account was created for you on TrackMate.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await sendEmail({
      to: email,
      toName: fullName,
      subject: 'Welcome to TrackMate \u2013 Your Smart Commute Starts Now',
      html
    });
    if (success) console.log(`\u2705 Welcome email sent to ${email}`);
    return success;
  } catch (error) {
    console.error('Failed to send welcome email:', error.message);
    return false;
  }
};

/**
 * Send stop arrival notification email (backup for push)
 * @param {Object} params - Email parameters
 * @param {string} params.email - Student email
 * @param {string} params.fullName - Student name
 * @param {string} params.stopName - Stop name
 * @param {number} params.etaMinutes - ETA in minutes
 * @returns {Promise<boolean>} Success status
 */
const sendStopArrivalEmail = async ({ email, fullName, stopName, etaMinutes }) => {
  try {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bus Arriving</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#F57C00 0%,#FF9800 50%,#FFB74D 100%);border-radius:12px 12px 0 0;padding:30px 32px;text-align:center;">
          <img src="https://trackmaterce.onrender.com/email-logo.png" alt="TrackMate" width="50" height="50" style="display:block;margin:0 auto;border-radius:12px;" />
          <h1 style="margin:12px 0 0;font-size:22px;font-weight:700;color:#FFFFFF;">Bus Arriving Soon</h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.9);">TrackMate Alert</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#FFFFFF;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <p style="margin:0 0 20px;font-size:16px;color:#2D2D2D;">Hi <strong>${fullName}</strong>,</p>

          <!-- ETA Card -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF8F0;border:1px solid #FFE0B2;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:42px;font-weight:700;color:#F57C00;">${etaMinutes}<span style="font-size:18px;font-weight:400;"> min</span></p>
              <p style="margin:0;font-size:15px;color:#555;">until arrival at <strong style="color:#E65100;">${stopName}</strong></p>
            </td></tr>
          </table>

          <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">Your bus is almost at your stop. Please make your way there and be ready to board.</p>

          <!-- CTA -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td align="center">
              <a href="https://trackmaterce.onrender.com/" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#F57C00,#FF9800);color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:8px;box-shadow:0 3px 10px rgba(245,124,0,0.3);">Track Live</a>
            </td></tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 32px;text-align:center;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#888;">TrackMate Team</p>
          <p style="margin:0;font-size:11px;color:#BBB;">Smart Campus Transportation System</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await sendEmail({
      to: email,
      toName: fullName,
      subject: `Bus arriving at ${stopName} in ${etaMinutes} min`,
      html,
      fromName: 'TrackMate Alerts'
    });
    return success;
  } catch (error) {
    console.error('Failed to send stop arrival email:', error.message);
    return false;
  }
};

/**
 * Send password reset email
 * @param {Object} params - Email parameters
 * @param {string} params.email - User email address
 * @param {string} params.fullName - User full name
 * @param {string} params.username - Username/roll number (also the reset password)
 * @returns {Promise<boolean>} Success status
 */
const sendPasswordResetEmail = async ({ email, fullName, username }) => {
  try {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F5F5F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#F57C00 0%,#FF9800 50%,#FFB74D 100%);border-radius:12px 12px 0 0;padding:36px 32px;text-align:center;">
          <img src="https://trackmaterce.onrender.com/email-logo.png" alt="TrackMate" width="56" height="56" style="display:block;margin:0 auto;border-radius:14px;" />
          <h1 style="margin:14px 0 0;font-size:24px;font-weight:700;color:#FFFFFF;">Password Updated</h1>
          <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">TrackMate – Smart Bus Tracking</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background-color:#FFFFFF;padding:36px 32px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#2D2D2D;">Hi ${fullName},</h2>
          <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">Your password has been reset successfully. Use the credentials below to log back in.</p>

          <!-- Credentials Card -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF8F0;border:1px solid #FFE0B2;border-radius:10px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#E65100;">&#128100;&nbsp; Login Credentials</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#444;">
                <tr>
                  <td style="padding:8px 0;font-weight:600;color:#795548;width:160px;">Username</td>
                  <td style="padding:8px 0;"><code style="background:#FFF3E0;padding:3px 10px;border-radius:4px;font-size:14px;color:#E65100;font-weight:600;">${username}</code></td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-weight:600;color:#795548;border-top:1px solid #FFE0B2;">Temporary Password</td>
                  <td style="padding:8px 0;border-top:1px solid #FFE0B2;"><code style="background:#FFF3E0;padding:3px 10px;border-radius:4px;font-size:14px;color:#E65100;font-weight:600;">${username}</code></td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- Security Warning -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF3E0;border-left:4px solid #F57C00;border-radius:0 10px 10px 0;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#E65100;">&#128274;&nbsp; Change Your Password</p>
              <p style="margin:0;font-size:13px;color:#6D4C00;line-height:1.5;">Please update your password immediately after logging in. Your temporary password is your roll number for security purposes.</p>
            </td></tr>
          </table>

          <!-- Not You -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAFAFA;border-radius:10px;margin-bottom:28px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#888;">&#9888;&#65039;&nbsp; Didn't request this?</p>
              <p style="margin:0;font-size:13px;color:#777;line-height:1.5;">If you did not request a password reset, please contact the TrackMate administrator immediately.</p>
            </td></tr>
          </table>

          <!-- CTA Button -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td align="center" style="padding-bottom:8px;">
              <a href="https://trackmaterce.onrender.com/" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#F57C00,#FF9800);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 36px;border-radius:8px;box-shadow:0 3px 10px rgba(245,124,0,0.3);">Log In Now</a>
            </td></tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 32px;text-align:center;">
          <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#888;">TrackMate Team</p>
          <p style="margin:0 0 14px;font-size:12px;color:#AAA;">Smart Campus Transportation System</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
            <tr>
              <td style="padding:0 8px;"><a href="https://trackmaterce.onrender.com/" style="font-size:12px;color:#F57C00;text-decoration:none;">Dashboard</a></td>
              <td style="color:#DDD;font-size:12px;">|</td>
              <td style="padding:0 8px;"><a href="https://maganti-praveen.github.io/TrackMate/" style="font-size:12px;color:#F57C00;text-decoration:none;">Website</a></td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#BBB;">You received this email because a password reset was requested for your TrackMate account.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const success = await sendEmail({
      to: email,
      toName: fullName,
      subject: 'TrackMate \u2013 Your Password Has Been Reset',
      html
    });
    if (success) console.log(`\u2705 Password reset email sent to ${email}`);
    return success;
  } catch (error) {
    console.error('Failed to send password reset email:', error.message);
    return false;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendStopArrivalEmail,
  sendPasswordResetEmail
};
