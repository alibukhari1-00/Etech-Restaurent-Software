const fs = require('fs').promises;
const path = require('path');
const os = require('os');

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

function validateSubmission(data) {
  const fieldLabels = {
    restaurant_name: 'Restaurant name',
    location: 'Location',
    restaurant_type: 'Cuisine type',
    total_branches: 'Total branches',
    staff_size: 'Staff size',
    daily_footfall: 'Daily customer footfall',
    kitchen_count: 'Kitchen count',
    menu_size: 'Menu size',
    waiter_smartphones: 'Smartphone readiness',
    current_billing: 'Current billing system',
    fbr_required: 'FBR POS integration requirement',
    main_goal: 'Primary objective'
  };

  const errors = [];
  const requiredFields = Object.keys(fieldLabels);

  for (const field of requiredFields) {
    if (!data[field] || !String(data[field]).trim()) {
      errors.push(`${fieldLabels[field]} is required.`);
    }
  }

  if (data.total_branches && Number(data.total_branches) <= 0) {
    errors.push('Total number of branches must be greater than 0.');
  }

  if (data.kitchen_count && Number(data.kitchen_count) <= 0) {
    errors.push('Number of kitchens must be greater than 0.');
  }

  const orderChannels = ['order_dinein', 'order_takeaway', 'order_delivery', 'order_online_apps'];
  if (!orderChannels.some((name) => data[name])) {
    errors.push('At least one active order channel must be selected.');
  }

  const orderSources = ['source_phone', 'source_whatsapp', 'source_apps'];
  if (!orderSources.some((name) => data[name])) {
    errors.push('At least one delivery order source must be selected.');
  }

  const paymentMethods = ['pay_cash', 'pay_card', 'pay_wallet', 'pay_qr'];
  if (!paymentMethods.some((name) => data[name])) {
    errors.push('At least one payment method must be selected.');
  }

  return errors;
}

async function appendCsv(csvContent) {
  const csvDir = path.join(os.tmpdir(), 'restaurant-survey');
  const csvPath = path.join(csvDir, 'submissions.csv');
  await fs.mkdir(csvDir, { recursive: true });

  const fileExists = await fs.stat(csvPath).then(() => true).catch(() => false);
  if (!fileExists) {
    await fs.writeFile(csvPath, csvContent, 'utf8');
  } else {
    const rowsOnly = csvContent.split('\n').slice(1).join('\n');
    await fs.appendFile(csvPath, `${rowsOnly}\n`, 'utf8');
  }

  return csvPath;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  let data;
  try {
    data = await parseBody(req);
  } catch (err) {
    res.status(400).json({ error: 'Unable to parse request body.' });
    return;
  }

  const validationErrors = validateSubmission(data);
  if (validationErrors.length > 0) {
    res.status(400).json({ error: validationErrors.join(' ') });
    return;
  }

  const submission = normalizeCheckboxes(data);
  const csvContent = buildCsv(submission);

  try {
    const savedPath = await appendCsv(csvContent);
    res.status(200).json({ message: `Submission saved to CSV. Path: ${savedPath}` });
  } catch (error) {
    console.error('CSV save failed:', error);
    res.status(500).json({ error: 'Unable to save submission to CSV.' });
  }
};
