import { useEffect, useState } from "react";
import { api, saveIdentity, storedPlayer, type Identity } from "./api";

export function useIdentity() {
  const [player, setPlayer] = useState(storedPlayer());
  const [recoveryCode, setRecoveryCode] = useState<string>();
  const [loading, setLoading] = useState(!player);
  const [error, setError] = useState<string>();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (player || !navigator.onLine) { setLoading(false); return; }
    api.createPlayer().then((identity) => {
      saveIdentity(identity); setPlayer(identity.player); setRecoveryCode(identity.recoveryCode);
    }).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, [player]);

  useEffect(() => {
    if (!player || !navigator.onLine) return;
    api.profile().then((profile) => { setPlayer(profile.player); setStreak(profile.streak); }).catch(() => undefined);
  }, [player?.id]);

  async function recover(code: string) {
    const identity = await api.recover(code);
    saveIdentity(identity); setPlayer(identity.player); setRecoveryCode(identity.recoveryCode);
  }

  async function rename(nickname: string) {
    const updated = await api.rename(nickname);
    const next = player && { ...player, ...updated };
    if (next) { localStorage.setItem("pathweave-player", JSON.stringify(next)); setPlayer(next); }
  }

  async function refreshProfile() {
    const profile = await api.profile();
    setPlayer(profile.player); setStreak(profile.streak);
    localStorage.setItem("pathweave-player", JSON.stringify(profile.player));
  }

  return { player, streak, recoveryCode, clearRecovery: () => setRecoveryCode(undefined), loading, error, recover, rename, refreshProfile };
}
