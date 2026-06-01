"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  LogOut,
  Trash2,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Avatar } from "@/components/Avatar";
import { ChessLayout } from "@/components/ChessLayout";

type ProfileData = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showGuard, setShowGuard] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const initialNameRef = useRef<string>("");
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [stagedAvatarFile, setStagedAvatarFile] = useState<File | null>(null);
  const [stagedAvatarRemove, setStagedAvatarRemove] = useState(false);
  const [stagedAvatarPreviewUrl, setStagedAvatarPreviewUrl] = useState<
    string | null
  >(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/auth/signin");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load profile");
      setData(json);
      setNameInput(json.full_name || "");
      initialNameRef.current = json.full_name || "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss success toast.
  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => setSuccess(null), 3500);
    return () => window.clearTimeout(id);
  }, [success]);

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const trimmed = nameInput.trim();
      if (trimmed && trimmed !== initialNameRef.current) {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: trimmed }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Failed to update name");
      }
      if (stagedAvatarRemove) {
        const resDel = await fetch("/api/profile/avatar", { method: "DELETE" });
        const jsonDel = await resDel.json().catch(() => ({}));
        if (!resDel.ok)
          throw new Error(jsonDel.error || "Failed to remove avatar");
      } else if (stagedAvatarFile) {
        const form = new FormData();
        form.append("file", stagedAvatarFile);
        const res3 = await fetch("/api/profile/avatar", {
          method: "POST",
          body: form,
        });
        const json3 = await res3.json().catch(() => ({}));
        if (!res3.ok) throw new Error(json3.error || "Failed to upload avatar");
      }

      await load();
      setStagedAvatarFile(null);
      setStagedAvatarRemove(false);
      if (stagedAvatarPreviewUrl) {
        URL.revokeObjectURL(stagedAvatarPreviewUrl);
        setStagedAvatarPreviewUrl(null);
      }
      setShowGuard(false);
      setSuccess("Profile saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const onAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Max 10MB.");
      e.currentTarget.value = "";
      return;
    }
    if (stagedAvatarPreviewUrl) URL.revokeObjectURL(stagedAvatarPreviewUrl);
    const url = URL.createObjectURL(file);
    setStagedAvatarPreviewUrl(url);
    setStagedAvatarFile(file);
    setStagedAvatarRemove(false);
    e.currentTarget.value = "";
  };

  const logout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/auth/signin");
  };

  const isDirty = useMemo(
    () =>
      nameInput.trim() !== initialNameRef.current ||
      stagedAvatarRemove ||
      stagedAvatarFile !== null,
    [nameInput, stagedAvatarRemove, stagedAvatarFile],
  );

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__PROFILE_DIRTY__ = isDirty;
    return () => {
      (window as unknown as Record<string, unknown>).__PROFILE_DIRTY__ = false;
    };
  }, [isDirty]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const onGuard = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as
        | { href?: string }
        | undefined;
      if (isDirty) {
        setPendingHref(detail?.href ?? null);
        setShowGuard(true);
      } else if (detail?.href) {
        window.location.href = detail.href;
      }
    };
    window.addEventListener("profile-guard", onGuard as EventListener);
    return () =>
      window.removeEventListener("profile-guard", onGuard as EventListener);
  }, [isDirty]);

  const avatarSrc = stagedAvatarRemove
    ? null
    : stagedAvatarPreviewUrl || data?.avatar_url || null;

  return (
    <ChessLayout
      title="Profile"
      subtitle="Manage your player identity and account settings."
      className="max-w-none"
    >
      <div className="mx-auto w-full max-w-3xl">
        {loading ? (
          <div className="surface-card p-10 text-center text-sm text-muted">
            Loading…
          </div>
        ) : !data ? (
          <div
            className="rounded-md px-3 py-2 text-sm"
            style={{
              background: "var(--danger-soft)",
              color: "var(--text)",
              border:
                "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
            }}
          >
            {error || "Profile unavailable."}
          </div>
        ) : (
          <>
            {/* Identity card */}
            <section
              className="surface-card mb-6 p-6"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                <div className="relative shrink-0">
                  <Avatar
                    name={data.full_name || data.username || data.email}
                    url={avatarSrc}
                    size={96}
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full transition-transform hover:scale-105"
                    style={{
                      background: "var(--text)",
                      color: "var(--accent-fg)",
                      border: "2px solid var(--bg)",
                    }}
                    aria-label="Change profile picture"
                    title="Change profile picture"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <div
                    className="text-base font-semibold truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {data.username ? `@${data.username}` : "—"}
                  </div>
                  {data.full_name && (
                    <div
                      className="text-sm truncate"
                      style={{ color: "var(--text-2)" }}
                    >
                      {data.full_name}
                    </div>
                  )}
                  <div
                    className="mt-1 text-xs truncate"
                    style={{ color: "var(--text-3)" }}
                  >
                    {data.email || "—"}
                  </div>

                  {(stagedAvatarPreviewUrl || stagedAvatarRemove) && (
                    <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--text-3)" }}
                      >
                        {stagedAvatarRemove
                          ? "Picture removal staged."
                          : "New picture staged."}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (stagedAvatarPreviewUrl)
                            URL.revokeObjectURL(stagedAvatarPreviewUrl);
                          setStagedAvatarPreviewUrl(null);
                          setStagedAvatarFile(null);
                          setStagedAvatarRemove(false);
                        }}
                        className="text-[11px] underline-offset-2 hover:underline"
                        style={{ color: "var(--text-2)" }}
                      >
                        Undo
                      </button>
                    </div>
                  )}
                </div>

                {data.avatar_url && !stagedAvatarRemove && (
                  <button
                    type="button"
                    onClick={() => {
                      setStagedAvatarRemove(true);
                      setStagedAvatarFile(null);
                      if (stagedAvatarPreviewUrl) {
                        URL.revokeObjectURL(stagedAvatarPreviewUrl);
                        setStagedAvatarPreviewUrl(null);
                      }
                    }}
                    className="btn-ghost inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs"
                    title="Remove picture"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                )}
              </div>
            </section>

            {/* Editable form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveAll();
              }}
              className="space-y-6"
            >
              <section
                className="surface-card p-6"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                <div
                  className="mb-4 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-3)" }}
                >
                  Account
                </div>
                <div>
                  <label
                    htmlFor="prof-fullname"
                    className="mb-1.5 block text-xs font-medium"
                    style={{ color: "var(--text-2)" }}
                  >
                    Full name
                  </label>
                  <input
                    id="prof-fullname"
                    className="input"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
              </section>


              {error && (
                <div
                  className="rounded-md px-3 py-2 text-sm"
                  style={{
                    background: "var(--danger-soft)",
                    color: "var(--text)",
                    border:
                      "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
                  }}
                  role="alert"
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  className="rounded-md px-3 py-2 text-sm"
                  style={{
                    background: "var(--success-soft)",
                    color: "var(--text)",
                    border:
                      "1px solid color-mix(in oklch, var(--success) 40%, transparent)",
                  }}
                  role="status"
                >
                  {success}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={logout}
                  className="btn-ghost inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm"
                  style={{ color: "var(--text-3)" }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-3)" }}
                    >
                      Unsaved changes
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={saving || !isDirty}
                    className="btn-accent rounded-md px-4 py-1.5 text-sm"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>

      {showGuard && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: "oklch(0 0 0 / 0.55)" }}
        >
          <div
            className="surface-card w-full max-w-sm p-5"
            style={{ boxShadow: "var(--shadow-lg)" }}
          >
            <div className="text-base font-semibold tracking-tight">
              Unsaved changes
            </div>
            <p className="mt-1 text-sm text-muted">
              Save before leaving the page?
            </p>
            {error && (
              <div
                className="mt-3 rounded-md px-3 py-2 text-sm"
                style={{
                  background: "var(--danger-soft)",
                  color: "var(--text)",
                  border:
                    "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
                }}
              >
                {error}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost rounded-md px-3 py-1.5 text-sm"
                onClick={() => setShowGuard(false)}
              >
                Stay
              </button>
              <button
                type="button"
                className="btn-secondary rounded-md px-3 py-1.5 text-sm"
                onClick={() => {
                  setShowGuard(false);
                  (
                    window as unknown as Record<string, unknown>
                  ).__PROFILE_DIRTY__ = false;
                  const href = pendingHref;
                  setPendingHref(null);
                  if (href) window.location.href = href;
                }}
              >
                Discard
              </button>
              <button
                type="button"
                className="btn-accent rounded-md px-3 py-1.5 text-sm"
                onClick={async () => {
                  await saveAll();
                  if (!error) {
                    const href = pendingHref;
                    setPendingHref(null);
                    if (href) window.location.href = href;
                  }
                }}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onAvatarFileSelected}
      />
    </ChessLayout>
  );
}
