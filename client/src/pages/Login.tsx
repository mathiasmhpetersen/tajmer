import { useState } from "react";
import { Mic2 } from "lucide-react";
import { login } from "@/lib/api";
import { Button } from "@/components/ui/Button";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      await login(password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <Mic2 className="size-6" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Tajmer · Live Ads</h1>
          <p className="mt-1.5 text-sm text-muted">Log ind for at se annoncerne.</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-card border border-hairline bg-card p-6"
        >
          <label htmlFor="password" className="text-sm font-medium">
            Adgangskode
          </label>
          <input
            id="password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-hairline bg-card-2 px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent/60"
            placeholder="••••••••"
          />
          {error && <p className="mt-3 text-sm text-[rgb(240,120,110)]">{error}</p>}
          <Button type="submit" size="md" loading={loading} className="mt-5 w-full">
            Log ind
          </Button>
        </form>
      </div>
    </div>
  );
}
