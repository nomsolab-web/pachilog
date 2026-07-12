const KEY = "pachilog_voter_fingerprint";

export function getVoterFingerprint(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
