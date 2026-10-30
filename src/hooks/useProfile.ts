"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { describeConflict, type ConflictSummary } from "@/lib/conflicts/display";
import { ProfileConflictSchema, type ProfileConflict } from "@/lib/conflicts/schema";
import { changedFields, toDisplayRows } from "@/lib/profile/display";
import { TravelProfileSchema, type ProfileField, type TravelProfile } from "@/lib/profile/schema";

const ProfileResponseSchema = z.object({ profile: TravelProfileSchema });
const ConflictsResponseSchema = z.object({ conflicts: z.array(ProfileConflictSchema) });

// How long a just-updated field stays highlighted.
const HIGHLIGHT_MS = 2500;

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return schema.parse(await res.json());
}

interface ProfileState {
  profile: TravelProfile;
  conflicts: ProfileConflict[];
}

// Fields that changed, or gained a conflict, between two loads.
function updatedFields(before: ProfileState, after: ProfileState): ProfileField[] {
  const known = new Set(before.conflicts.map((c) => c.id));
  const newConflictFields = after.conflicts.filter((c) => !known.has(c.id)).map((c) => c.field);
  return [...new Set([...changedFields(before.profile, after.profile), ...newConflictFields])];
}

// Loads the saved profile and pending conflicts, and tracks which fields the
// latest refresh changed.
export function useProfile() {
  const [state, setState] = useState<ProfileState | null>(null);
  const [highlighted, setHighlighted] = useState<ProfileField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const previous = useRef<ProfileState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [{ profile }, { conflicts }] = await Promise.all([
        fetchJson("/api/profile", ProfileResponseSchema),
        fetchJson("/api/conflicts", ConflictsResponseSchema),
      ]);
      const next = { profile, conflicts };
      if (previous.current) setHighlighted(updatedFields(previous.current, next));
      previous.current = next;
      setState(next);
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

  const rows = useMemo(() => (state ? toDisplayRows(state.profile) : null), [state]);

  const conflictsByField = useMemo(() => {
    const byField: Partial<Record<ProfileField, ConflictSummary[]>> = {};
    for (const conflict of state?.conflicts ?? []) {
      (byField[conflict.field] ??= []).push(describeConflict(conflict));
    }
    return byField;
  }, [state]);

  return { rows, conflictsByField, highlighted, error, refresh };
}
