import type { ProfileDisplayRow } from "@/lib/profile/display";
import type { ProfileField } from "@/lib/profile/schema";

interface ProfilePanelProps {
  // null while the profile is loading.
  rows: ProfileDisplayRow[] | null;
  highlighted?: ProfileField[];
  error?: string | null;
}

export function ProfilePanel({ rows, highlighted = [], error = null }: ProfilePanelProps) {
  return (
    <aside
      aria-label="Travel profile"
      className="flex w-full shrink-0 flex-col border-t border-zinc-200 bg-zinc-50 md:w-80 md:border-t-0 md:border-l dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      <header className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Your travel profile</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Updated as you chat</p>
      </header>
      {error && (
        <p role="alert" className="px-5 pt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {rows === null ? (
        <p className="px-5 py-4 text-sm text-zinc-400">Loading…</p>
      ) : (
        <dl className="flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
          {rows.map((row) => (
            <div
              key={row.field}
              data-field={row.field}
              data-updated={highlighted.includes(row.field) || undefined}
              className="rounded-lg px-2 py-2 transition-colors duration-700 data-updated:bg-amber-100 dark:data-updated:bg-amber-900/40"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {row.label}
              </dt>
              <dd className="mt-1.5">
                {row.values.length === 0 ? (
                  <span className="text-sm text-zinc-400 italic">Not set</span>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {row.values.map((value) => (
                      <li
                        key={value}
                        className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        {value}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}
