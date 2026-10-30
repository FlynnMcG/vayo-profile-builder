"use client";

import { useProfile } from "@/hooks/useProfile";
import { ChatPanel } from "./chat/ChatPanel";
import { ProfilePanel } from "./profile/ProfilePanel";

// Connects the chat to the profile panel: the profile refreshes whenever a
// profile tool finishes (mid-turn) and when each reply ends.
export function ProfileBuilder() {
  const { rows, conflictsByField, highlighted, error, refresh } = useProfile();

  return (
    <>
      <ChatPanel onProfileMayHaveChanged={refresh} />
      <ProfilePanel rows={rows} conflictsByField={conflictsByField} highlighted={highlighted} error={error} />
    </>
  );
}
