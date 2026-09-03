export type AuthenticatedUser = { id: string; email: string };

export function founderIdentityFromSession(
  user: AuthenticatedUser | null,
  founderEmail = process.env.CORELOOM_FOUNDER_EMAIL,
): AuthenticatedUser {
  if (!user) throw new Error("Sign-in is required");
  if (!founderEmail || user.email.trim().toLowerCase() !== founderEmail.trim().toLowerCase()) {
    throw new Error("Founder account is required");
  }
  return user;
}
