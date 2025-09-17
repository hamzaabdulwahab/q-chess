"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Avatar } from "@/components/Avatar";

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
  const [nameInput, setNameInput] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  // Removed inline avatar upload overlay; avatar can be changed via global menu
  const [showGuard, setShowGuard] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const initialNameRef = useRef<string>("");
  // Avatar dropdown menu & viewer
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  // Staged avatar changes (persist only on Save)
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

  // Close avatar menu on outside click or Escape
  useEffect(() => {
    if (!avatarMenuOpen) return;
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const el = avatarWrapRef.current;
      if (!el) return;
      const target = ev.target as Node | null;
      if (target && el.contains(target)) return;
      setAvatarMenuOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setAvatarMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [avatarMenuOpen]);

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      // Update name if changed
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

      // Update password if provided
      if (pw || pw2) {
        if (pw.length < 8)
          throw new Error("Password must be at least 8 characters.");
        if (pw !== pw2) throw new Error("Passwords do not match.");
        const res2 = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw }),
        });
        const json2 = await res2.json().catch(() => ({}));
        if (!res2.ok)
          throw new Error(json2.error || "Failed to change password");
      }

      // Persist staged avatar changes
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
      // Clear staged avatar state
      setStagedAvatarFile(null);
      setStagedAvatarRemove(false);
      if (stagedAvatarPreviewUrl) {
        URL.revokeObjectURL(stagedAvatarPreviewUrl);
        setStagedAvatarPreviewUrl(null);
      }
      setPw("");
      setPw2("");
      setShowGuard(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Stage avatar change (do not persist until Save)
  const onAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Max 10MB allowed.");
      e.currentTarget.value = "";
      return;
    }
    if (stagedAvatarPreviewUrl) URL.revokeObjectURL(stagedAvatarPreviewUrl);
    const url = URL.createObjectURL(file);
    setStagedAvatarPreviewUrl(url);
    setStagedAvatarFile(file);
    setStagedAvatarRemove(false);
    setAvatarMenuOpen(false);
    e.currentTarget.value = "";
  };

  const logout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/auth/signin");
  };

  // Track unsaved changes across the app (for header links)
  const isDirty = useMemo(
    () =>
      nameInput.trim() !== initialNameRef.current ||
      pw.length > 0 ||
      pw2.length > 0 ||
      stagedAvatarRemove ||
      stagedAvatarFile !== null,
    [nameInput, pw, pw2, stagedAvatarRemove, stagedAvatarFile]
  );

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__PROFILE_DIRTY__ = isDirty;
    return () => {
      (window as unknown as Record<string, unknown>).__PROFILE_DIRTY__ = false;
    };
  }, [isDirty]);

  // Warn on hard navigation (refresh/close)
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Listen for guard requests from header
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

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isDirty) {
      e.preventDefault();
      setPendingHref(href);
      setShowGuard(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 py-10">
      <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main card */}
        <div className="lg:col-span-2 bg-gray-800/60 backdrop-blur rounded-2xl p-8 border border-gray-700">
          <h1 className="text-3xl font-semibold mb-6 tracking-tight text-white">
            Your Profile
          </h1>
          {loading ? (
            <p>Loading…</p>
          ) : error ? (
            <p className="text-red-300">{error}</p>
          ) : data ? (
            <div className="space-y-8">
              {/* Header section with larger avatar and menu on click */}
              <div className="flex items-center gap-6">
                <div
                  ref={avatarWrapRef}
                  className="relative"
                  style={{ width: 112, height: 112 }}
                >
                  <button
                    type="button"
                    onClick={() => setAvatarMenuOpen((v) => !v)}
                    className="group block rounded-full outline-none focus:ring-2 focus:ring-accent"
                    aria-haspopup="menu"
                    aria-expanded={avatarMenuOpen}
                    title="Profile picture menu"
                    style={{ width: 112, height: 112 }}
                  >
                    <Avatar
                      name={data.full_name || data.username || data.email}
                      url={
                        stagedAvatarRemove
                          ? null
                          : stagedAvatarPreviewUrl || data.avatar_url
                      }
                      size={112}
                    />
                  </button>
                  {/* Avatar dropdown */}
                  <div
                    className={`absolute z-10 mt-2 w-56 rounded-lg border border-gray-700 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-200 shadow-xl transition-all duration-200 left-0 origin-top-left ${
                      avatarMenuOpen
                        ? "opacity-100 scale-100 translate-y-0"
                        : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
                    }`}
                  >
                    <div className="absolute -top-1.5 left-4 w-3 h-3 bg-gray-900 border-l border-t border-gray-700 rotate-45"></div>
                    <button
                      type="button"
                      onClick={() => avatarFileInputRef.current?.click()}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-800 hover:text-white transition-all duration-200"
                    >
                      Change Profile Picture
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStagedAvatarRemove(true);
                        setStagedAvatarFile(null);
                        if (stagedAvatarPreviewUrl) {
                          URL.revokeObjectURL(stagedAvatarPreviewUrl);
                          setStagedAvatarPreviewUrl(null);
                        }
                        setAvatarMenuOpen(false);
                      }}
                      disabled={
                        stagedAvatarRemove ||
                        (!stagedAvatarPreviewUrl && !data.avatar_url)
                      }
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-800 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Remove Picture
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAvatarViewer(true)}
                      disabled={
                        stagedAvatarRemove ||
                        !(stagedAvatarPreviewUrl || data.avatar_url)
                      }
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-800 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      View Profile Picture
                    </button>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-gray-400">Signed in as</div>
                  <div className="text-lg font-medium truncate tracking-tight">
                    {data.email || "-"}
                  </div>
                  <div className="mt-1 text-sm text-gray-400">Username</div>
                  <div className="text-base tracking-tight">
                    {data.username ? `@${data.username}` : "-"}
                  </div>
                </div>
                {(stagedAvatarRemove || stagedAvatarPreviewUrl) && (
                  <div className="text-xs text-gray-400 mt-2">
                    Avatar change is staged. Click &quot;Save changes&quot; to
                    apply.
                  </div>
                )}
              </div>

              {/* Edit form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveAll();
                }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-300 mb-1 font-medium tracking-normal">
                    Full Name
                  </label>
                  <input
                    className="w-full rounded-xl bg-gray-900 border border-gray-700 px-3 py-3 outline-none focus:border-accent text-base leading-6"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm text-gray-300 mb-2 font-medium tracking-tight">
                    Change Password
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="password"
                      className="w-full rounded-xl bg-gray-900 border border-gray-700 px-3 py-3 outline-none focus:border-accent text-base leading-6"
                      placeholder="New password (8+ chars)"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                    />
                    <input
                      type="password"
                      className="w-full rounded-xl bg-gray-900 border border-gray-700 px-3 py-3 outline-none focus:border-accent text-base leading-6"
                      placeholder="Confirm new password"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                    />
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <button
                    disabled={saving}
                    className="btn-accent disabled:opacity-60 text-black rounded-xl px-6 py-3 text-base font-semibold"
                    type="submit"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    onClick={logout}
                    className="bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-6 py-3 text-base border border-gray-600 font-medium"
                    type="button"
                  >
                    Log out
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
        {/* Right column: helpful tips / profile meta */}
        <aside className="bg-gray-800/60 backdrop-blur rounded-2xl p-6 border border-gray-700 h-max">
          <div className="text-xl font-semibold mb-3 tracking-tight">
            Profile Tips
          </div>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
            <li>Use a clear profile photo for better recognition.</li>
            <li>Pick a unique username you can share with friends.</li>
            <li>Passwords must be at least 8 characters.</li>
          </ul>
          <div className="mt-4 text-sm text-gray-400">
            Changes aren’t saved until you click &quot;Save changes&quot;.
          </div>
          <div className="mt-6 text-sm">
            <Link
              href="/"
              onClick={(e) => handleNav(e, "/")}
              className="link-accent hover:underline"
            >
              Back to Home
            </Link>
          </div>
        </aside>
      </div>

      {showGuard && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[92vw] max-w-md bg-gray-900 border border-gray-700 rounded-xl p-5 text-white">
            <div className="text-lg font-semibold mb-2">Unsaved changes</div>
            <p className="text-sm text-gray-300 mb-4">
              You have unsaved changes. Save them before leaving?
            </p>
            {error ? (
              <p className="text-sm text-red-300 mb-2">{error}</p>
            ) : null}
            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-2 text-sm rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700"
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
                className="px-3 py-2 text-sm rounded-lg btn-accent text-black disabled:opacity-60"
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
              <button
                className="px-3 py-2 text-sm rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700"
                onClick={() => setShowGuard(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for avatar changes */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onAvatarFileSelected}
      />

      {/* Viewer modal */}
      {showAvatarViewer && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setShowAvatarViewer(false)}
        >
          <div
            className="relative max-w-[90vw] max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {stagedAvatarRemove ? (
              <div className="text-gray-300">No profile picture</div>
            ) : stagedAvatarPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stagedAvatarPreviewUrl}
                alt="Profile picture preview"
                className="max-w-full max-h-[80vh] rounded-lg border border-gray-700"
              />
            ) : data?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.avatar_url}
                alt="Profile picture"
                className="max-w-full max-h-[80vh] rounded-lg border border-gray-700"
              />
            ) : (
              <div className="text-gray-300">No profile picture</div>
            )}
            <button
              onClick={() => setShowAvatarViewer(false)}
              className="absolute -top-3 -right-3 bg-gray-900 border border-gray-700 text-white rounded-full w-8 h-8 grid place-items-center hover:bg-gray-800"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
