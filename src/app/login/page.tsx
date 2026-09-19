import { signInWithGoogle, signInWithPassword } from "./actions";
import HashSession from "./HashSession";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const errorText =
    error === "google"
      ? "Google sign-in isn't configured yet. Use email and password, or see the README."
      : error === "auth"
        ? "Sign-in failed. Please try again."
        : error === "no_profile"
          ? "Your account has no profile yet. Ask an admin to check the database trigger."
          : error;

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
        <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
        <HashSession />

        {errorText && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {errorText}
          </p>
        )}

        <form action={signInWithGoogle} className="mt-6">
          <input type="hidden" name="next" value={next ?? "/"} />
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.7 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
              <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.1z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.7-2 15.5-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
        </form>

        <div className="flex items-center gap-3 my-6 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          or
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form action={signInWithPassword} className="space-y-3">
          <input type="hidden" name="next" value={next ?? "/"} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-400 text-center">
          No account? Ask an admin to invite you.
        </p>
      </div>
    </main>
  );
}
