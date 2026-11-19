export function validateLogin(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  // Login must accept existing passwords, not enforce a new signup policy.
  if (!password || password.length > 1024)
    errors.password = "Enter your password (up to 1024 characters).";
  return errors;
}
