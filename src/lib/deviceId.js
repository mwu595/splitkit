const STORAGE_KEY = 'splitkit_device_id';

/**
 * Returns a persistent device UUID.
 * Generated once on first call and stored in localStorage.
 */
export function getDeviceId() {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
