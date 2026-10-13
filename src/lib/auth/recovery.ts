export function authDestination(next: string | null) {
  return next === "/reset-password" ? "/reset-password" : "/dashboard";
}

export function passwordErrors(password: string, confirmation: string) {
  const errors: Partial<Record<"password" | "confirmPassword", string>> = {};
  if (password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  if (password !== confirmation)
    errors.confirmPassword = "Passwords do not match.";
  return errors;
}
