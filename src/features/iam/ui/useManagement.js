"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorOf } from "../model/management";

// Each panel owns its query. A late response from a previous scope cannot replace the current query.
export function useRemote(load) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    data: null,
    error: "",
    loading: true,
    load: null,
    revision: -1,
  });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setState({ data: null, error: "", loading: true, load, revision });
      try {
        const data = await load();
        if (active)
          setState({ data, error: "", loading: false, load, revision });
      } catch (error) {
        if (active)
          setState({
            data: null,
            error: errorOf(error),
            loading: false,
            load,
            revision,
          });
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const current = state.load === load && state.revision === revision;
  return {
    ...(current ? state : { data: null, error: "", loading: true }),
    reload,
  };
}

export function useOperation() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function run(action, message = "Alteração salva.") {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      return true;
    } catch (error) {
      setError(errorOf(error));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, notice, run };
}
