import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Sales Coach</p>
        <h1 className="mt-1 text-xl font-bold text-white">Sign in to continue</h1>
      </div>
      <SignIn />
    </div>
  );
}
