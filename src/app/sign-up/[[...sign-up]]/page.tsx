import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Sales Coach</p>
        <h1 className="mt-1 text-xl font-bold text-white">Create your account</h1>
      </div>
      <SignUp />
    </div>
  );
}
