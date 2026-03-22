export function getSessionHash(): string {
  const key = 'gradeos-session';
  let hash = localStorage.getItem(key);
  
  if (!hash) {
    hash = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(key, hash);
  }
  
  return hash;
}
