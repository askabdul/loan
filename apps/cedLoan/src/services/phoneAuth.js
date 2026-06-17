// OTP service — calls the backend API. No Firebase / reCAPTCHA required.
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

class PhoneAuthService {
  constructor() {
    this.pendingPhone = null;
  }

  /**
   * Send verification code via backend OTP service.
   * @param {string} phoneNumber - International format (+233XXXXXXXXX)
   * @param {string} _containerId - Ignored (legacy reCAPTCHA param)
   */
  async sendVerificationCode(phoneNumber, _containerId) {
    if (!phoneNumber || !phoneNumber.startsWith("+")) {
      throw new Error(
        "Phone number must be in international format (e.g., +233244123456)",
      );
    }

    const res = await fetch(`${API_URL}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || "Failed to send verification code");
    }

    this.pendingPhone = phoneNumber;

    // In non-production the backend echoes the OTP for easy testing
    if (data.devOtp) {
      console.log(`[DEV] OTP for ${phoneNumber}: ${data.devOtp}`);
    }

    return { success: true, message: data.message };
  }

  /**
   * Verify the 6-digit OTP code entered by the user.
   * @param {string} verificationCode
   */
  async verifyCode(verificationCode) {
    if (!this.pendingPhone) {
      throw new Error(
        "No verification in progress. Please request a new code.",
      );
    }

    if (!verificationCode || verificationCode.length !== 6) {
      throw new Error("Please enter a valid 6-digit verification code");
    }

    const res = await fetch(`${API_URL}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: this.pendingPhone,
        otp: verificationCode,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || "Invalid verification code");
    }

    const phone = this.pendingPhone;
    this.pendingPhone = null;

    return {
      success: true,
      user: { phoneNumber: phone },
      message: data.message,
    };
  }

  /**
   * Resend verification code — clears pending state and sends a new OTP.
   */
  async resendVerificationCode(phoneNumber, containerId) {
    this.pendingPhone = null;
    return this.sendVerificationCode(phoneNumber, containerId);
  }

  cleanup() {
    this.pendingPhone = null;
  }

  /**
   * Format phone number to international format (+233XXXXXXXXX for Ghana)
   */
  formatPhoneNumber(phoneNumber, countryCode = "+233") {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.startsWith("233")) return "+" + cleaned;
    if (cleaned.startsWith("0")) return countryCode + cleaned.substring(1);
    return countryCode + cleaned;
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber) {
    // Basic validation for international format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }
}

// Export singleton instance
export default new PhoneAuthService();
