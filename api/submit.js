const nodemailer = require('nodemailer');

function escapeCsv(value) {
  if (value == null) return '';
  const stringValue = String(value).replace(/\r?\n/g, ' ');
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildCsv(data) {
  const headers = [
    'Timestamp',
    'Restaurant Name',
    'Location',
    'Cuisine Type',
    'Total Branches',
    'Staff Size',
    'Daily Footfall',
    'Kitchen Count',
    'Order Dine-in',
    'Order Takeaway',
    'Order Delivery',
    'Order Online Apps',
    'Source Phone',
    'Source WhatsApp',
    'Source Apps',
    'Menu Size',
    'Waiter Smartphones',
    'Current Billing',
    'Pay Cash',
    'Pay Card',
    'Pay Wallet',
    'Pay QR',
    'FBR Required',
    'Main Goal'
  ];

  const row = [
    new Date().toISOString(),
    data.restaurant_name || '',
    data.location || '',
    data.restaurant_type || '',
    data.total_branches || '',
    data.staff_size || '',
    data.daily_footfall || '',
    data.kitchen_count || '',
    data.order_dinein || 'No',
    data.order_takeaway || 'No',
    data.order_delivery || 'No',
    data.order_online_apps || 'No',
    data.source_phone || 'No',
    data.source_whatsapp || 'No',
    data.source_apps || 'No',
    data.menu_size || '',
    data.waiter_smartphones || '',
    data.current_billing || '',
    data.pay_cash || 'No',
    data.pay_card || 'No',
    data.pay_wallet || 'No',
    data.pay_qr || 'No',
    data.fbr_required || '',
    data.main_goal || ''
  ];

  return `${headers.map(escapeCsv).join(',')}\n${row.map(escapeCsv).join(',')}\n`;
}

async function parseBody(req) {
  if (req.body && Object.keys(req.body).length) {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString();
  const contentType = (req.headers['content-type'] || '').toLowerCase();

  if (contentType.includes('application/json')) {
    return raw ? JSON.parse(raw) : {};
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  return {};
}

function normalizeCheckboxes(data) {
  return {
    ...data,
    order_dinein: data.order_dinein ? 'Yes' : 'No',
    order_takeaway: data.order_takeaway ? 'Yes' : 'No',
    order_delivery: data.order_delivery ? 'Yes' : 'No',
    order_online_apps: data.order_online_apps ? 'Yes' : 'No',
    source_phone: data.source_phone ? 'Yes' : 'No',
    source_whatsapp: data.source_whatsapp ? 'Yes' : 'No',
    source_apps: data.source_apps ? 'Yes' : 'No',
    pay_cash: data.pay_cash ? 'Yes' : 'No',
    pay_card: data.pay_card ? 'Yes' : 'No',
    pay_wallet: data.pay_wallet ? 'Yes' : 'No',
    pay_qr: data.pay_qr ? 'Yes' : 'No'
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const env = process.env;
  const GMAIL_USER = env.GMAIL_USER;
  const GMAIL_PASS = env.GMAIL_PASS;
  const TO_EMAIL = env.TO_EMAIL || env.GMAIL_USER;

  if (!GMAIL_USER || !GMAIL_PASS || !TO_EMAIL) {
    res.status(500).json({ error: 'Server is not configured. Please set GMAIL_USER, GMAIL_PASS, and TO_EMAIL.' });
    return;
  }

  let data;
  try {
    data = await parseBody(req);
  } catch (err) {
    res.status(400).json({ error: 'Unable to parse request body.' });
    return;
  }

  const submission = normalizeCheckboxes(data);
  const csvContent = buildCsv(submission);

  const plainText = `New Restaurant Discovery submission:\n\n${Object.entries(submission)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"Restaurant Survey" <${GMAIL_USER}>`,
    to: TO_EMAIL,
    subject: 'New Restaurant Discovery Submission',
    text: plainText,
    attachments: [
      {
        filename: 'restaurant-survey.csv',
        content: csvContent,
        contentType: 'text/csv'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Submission received. Email sent successfully.' });
  } catch (error) {
    console.error('Email send failed:', error);
    res.status(500).json({ error: 'Unable to send email. Check server logs and environment settings.' });
  }
};
