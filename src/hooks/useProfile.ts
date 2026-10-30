"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { changedFields, toDisplayRows } from "@/lib/profile/display";
import { TravelProfileSchema, type ProfileField, type TravelProfile } from "@/lib/profile/schema";

const ProfileResponseSchema = z.object({ profile: TravelProfileSchema });

// How long a just-updated field stays highlighted.
const HIGHLIGHT_MS = 2500;

async function fetchProfile(): Promise<TravelProfile> {
  const res = await fetch("/api/profile", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
  return ProfileResponseSchema.parse(await res.json()).profile;
}

// Loads the saved profile and tracks which fields the latest refresh changed.
export function useProfile() {
  const [profile, setProfile] = useState<TravelProfile | null>(null);
  const [highlighted, setHighlighted] = useState<ProfileField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previous = useRef<TravelProfile | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchProfile();
      if (previous.current) setHighlighted(changedFields(previous.current, next));
      previous.current = next;
      setProfile(next);
      setError(null);
    } catch {
      setError("Couldn't load your profile.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (highlighted.length === 0) return;
    const timer = setTimeout(() => setHighlighted([]), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlighted]);

  const rows = useMemo(() => (profile ? toDisplayRows(profile) : null), [profile]);

  return { rows, highlighted, error, refresh };
}
