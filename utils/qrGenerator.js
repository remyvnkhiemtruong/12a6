/**
 * VietQR Generator Utility
 * Features: 54-57, 126, 277
 */

const QRCode = require('qrcode');

// VietQR Bank IDs
const BANK_IDS = {
  'Vietcombank': '970436',
  'VietinBank': '970415',
  'BIDV': '970418',
  'Agribank': '970405',
  'Techcombank': '970407',
  'MB Bank': '970422',
  'ACB': '970416',
  'VPBank': '970432',
  'TPBank': '970423',
  'Sacombank': '970403',
  'HDBank': '970437',
  'VIB': '970441',
  'SHB': '970443',
  'Eximbank': '970431',
  'MSB': '970426',
  'OCB': '970448',
  'SeABank': '970440',
  'Nam A Bank': '970428',
  'Bac A Bank': '970409',
  'ABBANK': '970425'
};

/**
 * Generate VietQR URL for payment
 * @param {Object} options Payment options
 * @param {string} options.bankId - Bank BIN code
 * @param {string} options.accountNumber - Bank account number
 * @param {string} options.accountName - Account holder name
 * @param {number} options.amount - Payment amount
 * @param {string} options.description - Transfer description
 * @param {string} options.template - QR template (compact, compact2, qr_only, print)
 * @returns {string} VietQR image URL
 */
const generateVietQRUrl = (options) => {
  const {
    bankId = '970422', // Default: MB Bank
    accountNumber,
    accountName,
    amount,
    description,
    template = 'compact2'
  } = options;

  if (!accountNumber) {
    throw new Error('Account number is required');
  }

  // Build VietQR URL
  let url = `https://img.vietqr.io/image/${bankId}-${accountNumber}-${template}.png`;
  
  const params = new URLSearchParams();
  
  if (amount) {
    params.append('amount', amount.toString());
  }
  
  if (description) {
    params.append('addInfo', description);
  }
  
  if (accountName) {
    params.append('accountName', accountName);
  }
  
  const queryString = params.toString();
  if (queryString) {
    url += '?' + queryString;
  }
  
  return url;
};

/**
 * Generate VietQR data for an order
 * @param {Object} config System config with payment info
 * @param {Object} order Order data
 * @returns {Object} QR data with URL and copy info
 */
const generateOrderQR = (config, order) => {
  const description = `${config.payment.transferTemplate} ${order.shortId || order.orderNumber}`;
  
  return {
    qrUrl: generateVietQRUrl({
      bankId: config.payment.bankId,
      accountNumber: config.payment.accountNumber,
      accountName: config.payment.accountName,
      amount: order.pricing?.total || 0,
      description: description,
      template: config.payment.vietQRTemplate || 'compact2'
    }),
    bankName: config.payment.bankName || 'MB Bank',
    accountNumber: config.payment.accountNumber,
    accountName: config.payment.accountName,
    amount: order.pricing?.total || 0,
    description: description
  };
};

/**
 * Generate a generic QR code (for WiFi, etc.)
 * @param {string} data Data to encode
 * @param {Object} options QRCode options
 * @returns {Promise<string>} Base64 encoded QR image
 */
const generateQRCode = async (data, options = {}) => {
  const defaultOptions = {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    quality: 0.92,
    margin: 1,
    width: 300,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  };
  
  const finalOptions = { ...defaultOptions, ...options };
  
  return await QRCode.toDataURL(data, finalOptions);
};

/**
 * Generate WiFi QR Code (Feature 297)
 * @param {string} ssid WiFi network name
 * @param {string} password WiFi password
 * @param {string} security Security type (WPA, WEP, nopass)
 * @returns {Promise<string>} Base64 encoded QR image
 */
const generateWifiQR = async (ssid, password, security = 'WPA') => {
  // WiFi QR format: WIFI:T:WPA;S:ssid;P:password;;
  const wifiData = `WIFI:T:${security};S:${ssid};P:${password};;`;
  return await generateQRCode(wifiData);
};

module.exports = {
  BANK_IDS,
  generateVietQRUrl,
  generateOrderQR,
  generateQRCode,
  generateWifiQR
};
