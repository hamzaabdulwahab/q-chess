"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { LoadingSpinner } from "@/components/LoadingSpinner";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = getSupabaseBrowser();
        const code = params.get("code");
        const token = params.get("token");

        if (code || token) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (error) throw error;
        }

        await fetch("/api/ensure-profile", { method: "POST" });
        router.replace("/");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to sign in";
        setMessage(msg);
      }
    };
    run();
  }, [params, router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800/60 backdrop-blur rounded-xl p-6 border border-gray-700 text-center">
        <p>{message}</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CallbackInner />
    </Suspense>
  );
}
