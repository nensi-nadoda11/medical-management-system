export type FieldErrors<T> = Partial<Record<keyof T | "form", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const otpPattern = /^\d{6}$/;

export interface RegistrationValues {
  shopName: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface OtpValues {
  otp: string;
}

export interface LoginValues {
  email: string;
  password: string;
}

const isStrongPassword = (password: string) =>
  password.length >= 12 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

export const validateRegistration = (values: RegistrationValues): FieldErrors<RegistrationValues> => {
  const errors: FieldErrors<RegistrationValues> = {};

  if (!values.shopName.trim()) {
    errors.shopName = "Shop name is required.";
  } else if (values.shopName.trim().length < 2) {
    errors.shopName = "Shop name must be at least 2 characters.";
  }

  if (!values.fullName.trim()) {
    errors.fullName = "Full name is required.";
  } else if (values.fullName.trim().length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.mobileNumber.trim()) {
    errors.mobileNumber = "Mobile number is required.";
  } else if (values.mobileNumber.replace(/\D/g, "").length < 10) {
    errors.mobileNumber = "Enter a valid mobile number.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (!isStrongPassword(values.password)) {
    errors.password =
      "Use at least 12 characters with uppercase, lowercase, number, and special character.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Password confirmation does not match.";
  }

  if (!values.termsAccepted) {
    errors.termsAccepted = "You must accept the terms and conditions.";
  }

  return errors;
};

export const validateOtp = (values: OtpValues): FieldErrors<OtpValues> => {
  const errors: FieldErrors<OtpValues> = {};

  if (!values.otp.trim()) {
    errors.otp = "OTP is required.";
  } else if (!otpPattern.test(values.otp.trim())) {
    errors.otp = "Enter a valid 6-digit OTP.";
  }

  return errors;
};

export const validateLogin = (values: LoginValues): FieldErrors<LoginValues> => {
  const errors: FieldErrors<LoginValues> = {};

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  }

  return errors;
};
