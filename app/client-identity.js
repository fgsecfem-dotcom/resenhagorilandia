// Private bearer credential: only send in hello to the trusted room host.
// It must never be included in public users, room snapshots or diagnostics.
export function clientIdentitySecret(LS, crypto) {
  const saved = LS.get('identitySecret', null);
  if (typeof saved === 'string' && /^[a-f0-9]{64}$/.test(saved)) return saved;
  const secret = [...crypto.getRandomValues(new Uint8Array(32))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  LS.set('identitySecret', secret);
  return secret;
}
