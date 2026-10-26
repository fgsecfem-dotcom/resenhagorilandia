// Pure capture decisions shared by Electron and the regression tests.
function capturePolicy({ platform, release, compatibility = false }) {
  const parts = String(release).split('.').map(Number);
  const build = parts[2] || 0;
  // macOS 14.2 is Darwin 23.2. The current CoreAudio Tap capture path requires it.
  const macAudio = platform === 'darwin' && (parts[0] > 23 || parts[0] === 23 && parts[1] >= 2);
  // OBS enables process loopback from Windows 10 2004 (19041).
  // Actual audio initialization can still fail; the client retries video-only.
  return { compatibility, audioSupported: !compatibility && (macAudio || platform === 'win32' && parts[0] >= 10 && build >= 19041) };
}
module.exports = { capturePolicy };
