import { auth } from '../firebase/config';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  PhoneAuthProvider,
  signInWithCredential
} from 'firebase/auth';

class PhoneAuthService {
  constructor() {
    this.recaptchaVerifier = null;
    this.confirmationResult = null;
  }

  /**
   * Initialize reCAPTCHA verifier
   * @param {string} containerId - ID of the container element for reCAPTCHA
   * @param {boolean} invisible - Whether to use invisible reCAPTCHA
   */
  initializeRecaptcha(containerId, invisible = true) {
    try {
      // Clear existing verifier
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
      }

      const recaptchaConfig = {
        size: invisible ? 'invisible' : 'normal',
        callback: (response) => {
          console.log('reCAPTCHA solved:', response);
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
        },
        'error-callback': (error) => {
          console.error('reCAPTCHA error:', error);
        }
      };

      this.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        containerId,
        recaptchaConfig
      );

      return this.recaptchaVerifier;
    } catch (error) {
      console.error('Error initializing reCAPTCHA:', error);
      throw new Error('Failed to initialize reCAPTCHA verifier');
    }
  }

  /**
   * Send verification code to phone number
   * @param {string} phoneNumber - Phone number in international format (e.g., +233244123456)
   * @param {string} recaptchaContainerId - ID of the reCAPTCHA container
   * @returns {Promise} - Confirmation result for OTP verification
   */
  async sendVerificationCode(phoneNumber, recaptchaContainerId = 'recaptcha-container') {
    try {
      // Validate phone number format
      if (!phoneNumber || !phoneNumber.startsWith('+')) {
        throw new Error('Phone number must be in international format (e.g., +233244123456)');
      }

      // Initialize reCAPTCHA if not already done
      if (!this.recaptchaVerifier) {
        this.initializeRecaptcha(recaptchaContainerId, true);
      }

      // Send verification code
      console.log('Sending verification code to:', phoneNumber);
      this.confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        this.recaptchaVerifier
      );

      console.log('Verification code sent successfully');
      return {
        success: true,
        message: 'Verification code sent successfully',
        confirmationResult: this.confirmationResult
      };
    } catch (error) {
      console.error('Error sending verification code:', error);
      
      // Reset reCAPTCHA on error
      if (this.recaptchaVerifier) {
        try {
          this.recaptchaVerifier.clear();
          this.recaptchaVerifier = null;
        } catch (clearError) {
          console.error('Error clearing reCAPTCHA:', clearError);
        }
      }

      // Handle specific Firebase errors
      let errorMessage = 'Failed to send verification code';
      
      switch (error.code) {
        case 'auth/invalid-phone-number':
          errorMessage = 'Invalid phone number format';
          break;
        case 'auth/missing-phone-number':
          errorMessage = 'Phone number is required';
          break;
        case 'auth/quota-exceeded':
          errorMessage = 'SMS quota exceeded. Please try again later';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This phone number has been disabled';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Phone authentication is not enabled';
          break;
        case 'auth/captcha-check-failed':
          errorMessage = 'reCAPTCHA verification failed. Please try again';
          break;
        case 'auth/invalid-app-credential':
          errorMessage = 'Firebase configuration error. Please ensure your domain is authorized in Firebase console and try using 127.0.0.1 instead of localhost';
          break;
        default:
          errorMessage = error.message || 'Failed to send verification code';
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Verify the OTP code
   * @param {string} verificationCode - The 6-digit OTP code
   * @returns {Promise} - User credential if successful
   */
  async verifyCode(verificationCode) {
    try {
      if (!this.confirmationResult) {
        throw new Error('No verification in progress. Please request a new code');
      }

      if (!verificationCode || verificationCode.length !== 6) {
        throw new Error('Please enter a valid 6-digit verification code');
      }

      console.log('Verifying code:', verificationCode);
      const result = await this.confirmationResult.confirm(verificationCode);
      
      console.log('Phone verification successful:', result.user.uid);
      
      // Clear the confirmation result after successful verification
      this.confirmationResult = null;
      
      return {
        success: true,
        user: result.user,
        message: 'Phone number verified successfully'
      };
    } catch (error) {
      console.error('Error verifying code:', error);
      
      let errorMessage = 'Invalid verification code';
      
      switch (error.code) {
        case 'auth/invalid-verification-code':
          errorMessage = 'Invalid verification code. Please check and try again';
          break;
        case 'auth/code-expired':
          errorMessage = 'Verification code has expired. Please request a new one';
          break;
        case 'auth/session-expired':
          errorMessage = 'Verification session has expired. Please start over';
          break;
        default:
          errorMessage = error.message || 'Failed to verify code';
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Resend verification code
   * @param {string} phoneNumber - Phone number to resend code to
   * @param {string} recaptchaContainerId - ID of the reCAPTCHA container
   */
  async resendVerificationCode(phoneNumber, recaptchaContainerId = 'recaptcha-container') {
    try {
      // Clear existing verifier and confirmation
      this.cleanup();
      
      // Send new verification code
      return await this.sendVerificationCode(phoneNumber, recaptchaContainerId);
    } catch (error) {
      console.error('Error resending verification code:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.clear();
      } catch (error) {
        console.error('Error clearing reCAPTCHA:', error);
      }
      this.recaptchaVerifier = null;
    }
    this.confirmationResult = null;
  }

  /**
   * Format phone number to international format
   * @param {string} phoneNumber - Phone number to format
   * @param {string} countryCode - Country code (default: +233 for Ghana)
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phoneNumber, countryCode = '+233') {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // If it starts with country code digits, add the + sign
    if (cleaned.startsWith('233')) {
      return '+' + cleaned;
    }
    
    // If it starts with 0, replace with country code
    if (cleaned.startsWith('0')) {
      return countryCode + cleaned.substring(1);
    }
    
    // Otherwise, add country code
    return countryCode + cleaned;
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} - Whether the phone number is valid
   */
  isValidPhoneNumber(phoneNumber) {
    // Basic validation for international format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }
}

// Export singleton instance
export default new PhoneAuthService();