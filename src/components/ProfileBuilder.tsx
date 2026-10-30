"use client";

import { useProfile } from "@/hooks/useProfile";
import { ChatPanel } from "./chat/ChatPanel";
import { ProfilePanel } from "./profile/ProfilePanel";

// Connects the chat to the profile panel: each finished turn refreshes the
// profile, since the assistant may have updated it.
export function ProfileBuilder() {
  const { rows, conflictsByField, highlighted, error, refresh } = useProfile();

  return (
    <>
      <ChatPanel onTurnFinished={refresh} />
      <ProfilePanel rows={rows} conflictsByField={conflictsByField} highlighted={highlighted} error={error} />
    </>
  );
}
