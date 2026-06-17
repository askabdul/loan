const axios = require("axios");

const BRIDGE_BASE_URL = process.env.BRIDGE_BASE_URL || "https://api.bridgeagw.com";
const BRIDGE_PAYMENT_PATH = "/make_payment";
const BRIDGE_TXN_STATUS_PATH = "/get_transaction_status";

const BRIDGE_SUCCESS_CODE = "000";
const BRIDGE_FAILED_CODE = "001";
const BRIDGE_PENDING_CODE = "002";
const BRIDGE_CANCELLED_CODE = "003";

const NETWORK_MAP = {
  MTN: "MTN",
  Telecel: "VOD",
  AirtelTigo: "AIR",
};

// Ghana phone number → MoMo network (E.164 or local format)
const GHANA_NETWORK_PREFIXES = {
  MTN: ["024", "054", "055", "059", "025"],
  Telecel: ["020", "050"],
  AirtelTigo: ["026", "027", "056", "057"],
};

// Normalise any Ghana phone format to local 10-digit (e.g. +233244123456 → 0244123456)
function normalizeGhanaPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length >= 12) return "0" + digits.slice(3);
  if (digits.startsWith("0") && digits.length === 10) return digits;
  return digits;
}

function detectNetworkFromPhone(phone) {
  const local = normalizeGhanaPhone(phone);
  const prefix = local.slice(0, 3);
  for (const [network, prefixes] of Object.entries(GHANA_NETWORK_PREFIXES)) {
    if (prefixes.includes(prefix)) return network;
  }
  return null;
}

function isBridgeConfigured() {
  const basicAuth = process.env.BRIDGE_BASIC_AUTH?.trim();
  const username = process.env.BRIDGE_API_USERNAME || process.env.BRIDGE_USERNAME;
  const password = process.env.BRIDGE_API_PASSWORD || process.env.BRIDGE_PASSWORD;
  const serviceId = parseInt(process.env.BRIDGE_SERVICE_ID || "", 10);
  return !!(
    (basicAuth || (username && password)) &&
    Number.isFinite(serviceId)
  );
}

function formatBridgeRequestTime(date = new Date()) {
  const pad = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getBridgeAuthHeader() {
  const basicAuth = process.env.BRIDGE_BASIC_AUTH?.trim();
  if (basicAuth) {
    return basicAuth.startsWith("Basic ") ? basicAuth : `Basic ${basicAuth}`;
  }
  // Support both BRIDGE_API_USERNAME (canonical) and BRIDGE_USERNAME (legacy)
  const username = process.env.BRIDGE_API_USERNAME || process.env.BRIDGE_USERNAME;
  const password = process.env.BRIDGE_API_PASSWORD || process.env.BRIDGE_PASSWORD;
  if (!username || !password) return null;
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function buildCallbackUrl(req, pathSuffix = "/api/payments/webhook") {
  // BRIDGE_CALLBACK_URL is treated as a base URL; pathSuffix is always appended.
  // This lets CTM and DTM callbacks reach different routes on the same host.
  const base =
    process.env.BRIDGE_CALLBACK_URL?.replace(/\/$/, "") ||
    process.env.BACKEND_PUBLIC_URL?.replace(/\/$/, "");
  if (base) return `${base}${pathSuffix}`;
  const protocol = req?.headers?.["x-forwarded-proto"] || req?.protocol || "http";
  const host = req?.get?.("host") || "localhost:5000";
  return `${protocol}://${host}${pathSuffix}`;
}

function getBridgeStatusCode(data) {
  if (!data) return null;
  return (
    String(data.response_code || "") ||
    String(data.response_data?.status || "") ||
    String(data.status || "")
  );
}

function getBridgeStatusMessage(data) {
  if (!data) return "No response body from Bridge API";
  return (
    data.response_message ||
    data.response_data?.status_desc ||
    data.status_desc ||
    data.message ||
    "Bridge request processed"
  );
}

async function callBridgeApi(path, payload, timeoutMs = 20000) {
  const authHeader = getBridgeAuthHeader();
  const serviceId = parseInt(process.env.BRIDGE_SERVICE_ID || "", 10);

  if (!authHeader) {
    throw new Error(
      "Bridge credentials missing. Set BRIDGE_BASIC_AUTH or BRIDGE_USERNAME/BRIDGE_PASSWORD in .env",
    );
  }
  if (!Number.isFinite(serviceId)) {
    throw new Error("BRIDGE_SERVICE_ID is missing or invalid in .env");
  }

  const response = await axios.post(
    `${BRIDGE_BASE_URL}${path}`,
    { service_id: serviceId, ...payload },
    {
      timeout: timeoutMs,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    },
  );
  return response;
}

// Initiate MoMo collection — customer pays platform (CTM)
async function initiateBridgeCollection({ payment, loan, req, user }) {
  const timeoutMs = parseInt(process.env.BRIDGE_TIMEOUT_MS || "20000", 10);
  const providerCode = NETWORK_MAP[payment.mobileMoneyProvider];
  if (!providerCode) {
    throw new Error(
      `Unsupported mobile money provider: ${payment.mobileMoneyProvider}`,
    );
  }

  const callbackUrl = buildCallbackUrl(req, "/api/payments/webhook");
  const nickname =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "CEDI Customer";

  const payload = {
    reference: `Loan payment ${loan?.loanId || payment.id}`,
    customer_number: normalizeGhanaPhone(payment.mobileNumber),
    transaction_id: payment.transactionId,
    trans_type: "CTM",
    amount: parseFloat(payment.amount),
    nw: providerCode,
    nickname,
    payment_option: "MOM",
    currency_code: process.env.BRIDGE_CURRENCY_CODE || "GHS",
    currency_val: process.env.BRIDGE_CURRENCY_VALUE || "1",
    callback_url: callbackUrl,
    request_time: formatBridgeRequestTime(new Date()),
  };

  const response = await callBridgeApi(BRIDGE_PAYMENT_PATH, payload, timeoutMs);
  const responseBody = response.data || {};
  const responseCode = getBridgeStatusCode(responseBody);
  const responseMessage = getBridgeStatusMessage(responseBody);

  const accepted =
    response.status < 400 &&
    ["202", BRIDGE_SUCCESS_CODE, BRIDGE_PENDING_CODE].includes(responseCode);

  if (accepted) {
    await payment.update({
      status: "processing",
      gatewayResponse: {
        ...(payment.gatewayResponse || {}),
        initiatedAt: new Date().toISOString(),
        responseCode,
        responseMessage,
        httpStatus: response.status,
        callbackUrl,
        providerCode,
        requestPayload: { ...payload, service_id: undefined },
        rawResponse: responseBody,
      },
    });
  } else {
    await payment.markAsFailed(responseMessage, {
      ...(payment.gatewayResponse || {}),
      responseCode,
      responseMessage,
      httpStatus: response.status,
      callbackUrl,
      providerCode,
      rawResponse: responseBody,
    });
  }

  return {
    accepted,
    responseCode,
    responseMessage,
    responseBody,
    callbackUrl,
    httpStatus: response.status,
  };
}

// Initiate MoMo disbursement — platform sends money to customer (MTC = Mobile To Client)
async function initiateBridgeDisbursement({ loan, user, req }) {
  const timeoutMs = parseInt(process.env.BRIDGE_TIMEOUT_MS || "20000", 10);

  const phone = user?.phoneNumber;
  const detectedNetwork = detectNetworkFromPhone(phone);
  if (!detectedNetwork) {
    throw new Error(
      `Cannot determine MoMo network for phone ${phone}. ` +
      "Ensure the customer's phone number is a valid Ghana MoMo number.",
    );
  }

  const providerCode = NETWORK_MAP[detectedNetwork];
  const transactionId = `DISB-${loan.loanId || loan.id}-${Date.now()}`;

  // amountReceived = principal - upfrontFee (e.g. 80 for GHS 100 loan at 20% upfront)
  // Stored in the loan by _calculateAmounts at creation; fall back to full principal if missing.
  const principal = parseFloat(loan.amount);
  const disbursedAmount = parseFloat(loan.amountReceived) > 0
    ? parseFloat(loan.amountReceived)
    : principal;

  // Generic webhook — Bridge identifies the loan via the transaction_id we set
  const callbackUrl = buildCallbackUrl(req, "/api/loans/bridge-disbursement-webhook");

  const nickname =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "CEDI Customer";

  const payload = {
    reference: `Loan disbursement ${loan.loanId || loan.id}`,
    customer_number: normalizeGhanaPhone(phone),
    transaction_id: transactionId,
    trans_type: "MTC",   // Bridge API payout type (Mobile To Client)
    amount: disbursedAmount,
    nw: providerCode,
    nickname,
    payment_option: "MOM",
    currency_code: process.env.BRIDGE_CURRENCY_CODE || "GHS",
    currency_val: process.env.BRIDGE_CURRENCY_VALUE || "1",
    callback_url: callbackUrl,
    request_time: formatBridgeRequestTime(new Date()),
  };

  const response = await callBridgeApi(BRIDGE_PAYMENT_PATH, payload, timeoutMs);
  const responseBody = response.data || {};
  const responseCode = getBridgeStatusCode(responseBody);
  const responseMessage = getBridgeStatusMessage(responseBody);

  const accepted =
    response.status < 400 &&
    ["202", BRIDGE_SUCCESS_CODE, BRIDGE_PENDING_CODE].includes(responseCode);

  return {
    accepted,
    transactionId,
    disbursedAmount,
    detectedNetwork,
    providerCode,
    callbackUrl,
    responseCode,
    responseMessage,
    responseBody,
    httpStatus: response.status,
  };
}

async function syncPaymentFromBridgeStatus(payment, req = null) {
  const timeoutMs = parseInt(process.env.BRIDGE_TIMEOUT_MS || "20000", 10);
  const response = await callBridgeApi(
    BRIDGE_TXN_STATUS_PATH,
    { transaction_id: payment.transactionId },
    timeoutMs,
  );
  const statusBody = response.data || {};
  const statusCode = getBridgeStatusCode(statusBody);
  const statusMessage = getBridgeStatusMessage(statusBody);
  return { statusCode, statusMessage, raw: statusBody, response };
}

module.exports = {
  BRIDGE_BASE_URL,
  BRIDGE_PAYMENT_PATH,
  BRIDGE_TXN_STATUS_PATH,
  BRIDGE_SUCCESS_CODE,
  BRIDGE_FAILED_CODE,
  BRIDGE_PENDING_CODE,
  BRIDGE_CANCELLED_CODE,
  NETWORK_MAP,
  isBridgeConfigured,
  normalizeGhanaPhone,
  detectNetworkFromPhone,
  formatBridgeRequestTime,
  getBridgeAuthHeader,
  buildCallbackUrl,
  getBridgeStatusCode,
  getBridgeStatusMessage,
  callBridgeApi,
  initiateBridgeCollection,
  initiateBridgeDisbursement,
  syncPaymentFromBridgeStatus,
};
