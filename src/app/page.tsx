import { ChatPanel } from "@/components/chat/ChatPanel";
import { ProfilePanel } from "@/components/profile/ProfilePanel";
import { toDisplayRows } from "@/lib/profile/display";
import { placeholderProfile } from "@/lib/profile/placeholder";

export default function Home() {
  const profileRows = toDisplayRows(placeholderProfile);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
        <h1 className="text-base font-semibold">Vayo Profile Builder</h1>
      </header>
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <ChatPanel />
        <ProfilePanel rows={profileRows} />
      </main>
    </div>
  );
}
