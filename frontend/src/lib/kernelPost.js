import { toast } from 'sonner';

// kernelPost — thin fetch wrapper that surfaces the kernel's error/detail
// string via a toast instead of swallowing it. Used by every POST that
// forwards to the sealed TypeScript kernel via kernel_api.
//
// The kernel_api layer maps kernel errors to HTTPException(status_code=400,
// detail=<string>). We render `detail` verbatim so the player sees the
// exact reason (e.g. "You cannot destabilize your own government.").
export async function kernelPost(url, body, { successMessage } = {}) {
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  } catch (err) {
    toast.error(err?.message || 'Network error');
    return { ok: false, status: 0, error: err?.message || 'Network error' };
  }

  let payload = null;
  try { payload = await resp.json(); } catch { payload = null; }

  if (!resp.ok) {
    const detail =
      (payload && (payload.detail || payload.error || payload.message)) ||
      `Request failed (${resp.status})`;
    toast.error(String(detail));
    return { ok: false, status: resp.status, error: String(detail), payload };
  }

  if (successMessage) toast.success(successMessage);
  return { ok: true, status: resp.status, payload };
}
