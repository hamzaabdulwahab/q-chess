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
  const [uploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showGuard, setShowGuard] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const initialNameRef = useRef<string>("");

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

      // Upload avatar if chosen
      if (selectedFile) {
        if (selectedFile.size > 10 * 1024 * 1024) {
          throw new Error("Image too large. Max 10MB allowed.");
        }
        const form = new FormData();
        form.append("file", selectedFile);
        const res3 = await fetch("/api/profile/avatar", {
          method: "POST",
          body: form,
        });
        const json3 = await res3.json().catch(() => ({}));
        if (!res3.ok) throw new Error(json3.error || "Failed to upload avatar");
      }

      await load();
      setSelectedFile(null);
      setPw("");
      setPw2("");
      setShowGuard(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Enforce 10MB max on client
    if (file.size > 10 * 1024 * 1024) {
      setError("Image too large. Max 10MB allowed.");
      e.currentTarget.value = ""; // reset so user can pick again
      return;
    }
    setError(null);
    setSelectedFile(file);
  };

  const openPicker = () => fileInputRef.current?.click();

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
      selectedFile !== null,
    [nameInput, pw, pw2, selectedFile]
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
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-gray-800/60 backdrop-blur rounded-xl p-6 border border-gray-700">
        <h1 className="text-2xl font-semibold mb-4">Your Profile</h1>
        {loading ? (
          <p>Loading…</p>
        ) : error ? (
          <p className="text-red-300">{error}</p>
        ) : data ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative" style={{ width: 56, height: 56 }}>
                <Avatar
                  name={data.full_name || data.username || data.email}
                  url={data.avatar_url}
                  size={56}
                />
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-7 h-7 grid place-items-center rounded-full bg-gray-800 border border-gray-600 text-white hover:bg-gray-700 disabled:opacity-60"
                  aria-label="Change profile picture"
                  title="Change picture"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5"
                    aria-hidden
                  >
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.086 8.086a2 2 0 01-.878.502l-3.09.883a.5.5 0 01-.62-.62l.883-3.09a2 2 0 01.502-.878l8.086-8.086z" />
                    <path d="M12 5l3 3" />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileSelected}
                  className="hidden"
                />
              </div>
              <div>
                <div className="text-sm text-gray-400">Signed in as</div>
                <div className="text-sm">{data.email || "-"}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-400">Username</div>
                <div className="text-sm">
                  {data.username ? `@${data.username}` : "-"}
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveAll();
                }}
                className="space-y-2"
              >
                <label className="block text-sm text-gray-300">Full Name</label>
                <input
                  className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 outline-none focus:border-accent"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your full name"
                />
                <div className="space-y-2 pt-3">
                  <div className="text-sm text-gray-300">Change Password</div>
                  <input
                    type="password"
                    className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 outline-none focus:border-accent"
                    placeholder="New password (8+ chars)"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                  />
                  <input
                    type="password"
                    className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 outline-none focus:border-accent"
                    placeholder="Confirm new password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                  />
                </div>

                <button
                  disabled={saving}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white rounded-lg px-4 py-2 text-sm mt-4"
                  type="submit"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </form>
            </div>

            <button
              onClick={logout}
              className="w-full mt-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 font-medium border border-gray-600"
              type="button"
            >
              Log out
            </button>
          </div>
        ) : null}

        <div className="text-sm text-gray-300 mt-6 text-center">
          <Link
            href="/"
            onClick={(e) => handleNav(e, "/")}
            className="link-accent hover:underline"
          >
            Back to Home
          </Link>
        </div>
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
    </div>
  );
}
