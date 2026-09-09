/** Clerk env checks shared by middleware and server auth. */

export function hasClerkPublishableKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}

export function hasClerkSecretKey(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY?.trim());
}

/** clerkMiddleware and auth() both require the secret at runtime. */
export function hasClerkServerAuth(): boolean {
  return hasClerkPublishableKey() && hasClerkSecretKey();
}
