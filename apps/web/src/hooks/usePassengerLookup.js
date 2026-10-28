import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

export function usePassengerLookup(onPassengerFound, isEditMode = false) {
  const [lookupType, setLookupType] = useState("name");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupStatus, setLookupStatus] = useState(null); // null | 'found' | 'not_found'
  const [foundClient, setFoundClient] = useState(null);
  const [allMatches, setAllMatches] = useState([]);
  const [matchIndex, setMatchIndex] = useState(0);

  const lookupMutation = useMutation({
    mutationFn: async ({ type, value }) => {
      const res = await fetch("/api/appointments/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      const data = await res.json();
      if (data.found && data.client) {
        return {
          client: data.client,
          matches: data.all_matches || [data.client],
        };
      }
      return { client: null, matches: [] };
    },
    onSuccess: ({ client, matches }) => {
      // Filter out inactive clients — they should never appear as options
      const activeMatches = (matches || []).filter(
        (m) => m.is_active !== false,
      );
      setAllMatches(activeMatches);
      setMatchIndex(0);
      const activeClient = activeMatches.length > 0 ? activeMatches[0] : null;
      if (activeClient) {
        setLookupStatus("found");
        setFoundClient(activeClient);
        if (onPassengerFound && typeof onPassengerFound === "function") {
          onPassengerFound(activeClient);
        }
      } else {
        setLookupStatus("not_found");
        setFoundClient(null);
      }
    },
    onError: () => {
      setLookupStatus("not_found");
      setFoundClient(null);
      setAllMatches([]);
      setMatchIndex(0);
    },
  });

  const nextMatch = () => {
    const nextIndex = matchIndex + 1;
    if (nextIndex < allMatches.length) {
      setMatchIndex(nextIndex);
      const client = allMatches[nextIndex];
      setFoundClient(client);
      if (onPassengerFound && typeof onPassengerFound === "function") {
        onPassengerFound(client);
      }
    }
  };

  const prevMatch = () => {
    const prevIndex = matchIndex - 1;
    if (prevIndex >= 0) {
      setMatchIndex(prevIndex);
      const client = allMatches[prevIndex];
      setFoundClient(client);
      if (onPassengerFound && typeof onPassengerFound === "function") {
        onPassengerFound(client);
      }
    }
  };

  return {
    lookupType,
    setLookupType,
    lookupValue,
    setLookupValue,
    lookupStatus,
    setLookupStatus,
    lookupMutation,
    foundClient,
    allMatches,
    matchIndex,
    nextMatch,
    prevMatch,
  };
}
