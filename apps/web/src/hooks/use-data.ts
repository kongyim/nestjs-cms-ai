"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

export function useData<T>(path: string, initial: T, poll = 0) {
  const [data, setData] = useState<T>(initial),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void refresh();
    if (poll) {
      const timer = setInterval(() => void refresh(), poll);
      return () => clearInterval(timer);
    }
  }, [refresh, poll]);
  return { data, error, loading, refresh };
}
