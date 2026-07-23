"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Play, Square, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";

export function Header() {
  const [starting, setStarting] = useState(false);
  const [templateName, setTemplateName] = useState("Loading...");
  const [segmentCount, setSegmentCount] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  
  const isSessionActive = pathname?.includes("/session");

  useEffect(() => {
    // Load user info
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("display_name, role")
          .eq("email", user.email)
          .maybeSingle();
        
        if (profile) {
          setUserName(profile.display_name || user.email || "User");
          const parts = (profile.display_name || "U").split(" ");
          setUserInitials(parts.map((p: string) => p[0]).join("").toUpperCase().slice(0, 2));
        } else {
          setUserName(user.email || "User");
          setUserInitials((user.email || "U")[0].toUpperCase());
        }
      }
    };

    // Load active template info
    const loadTemplate = async () => {
      const { data } = await supabase
        .from("timelines_library")
        .select("name, default_duration_seconds, default_segments")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setTemplateName(data.name);
        setTotalDuration(data.default_duration_seconds);
        const segs = data.default_segments;
        setSegmentCount(Array.isArray(segs) ? segs.length : 0);
      }
    };

    loadUser();
    loadTemplate();
  }, []);

  const handleStartSession = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/session", { method: "POST" });
      const data = await res.json();
      if (data.sessionId) {
        router.push(`/session/${data.sessionId}`);
        setStarting(false);
      } else {
        console.error("Failed to start session", data.error);
        setStarting(false);
      }
    } catch (e) {
      console.error(e);
      setStarting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Left: Branding & Bulletin Info */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hover:opacity-80 transition-opacity cursor-pointer flex items-center" onClick={() => router.push("/dashboard")}>
            <Image 
              src="/logo.png" 
              alt="Sudriv" 
              width={100} 
              height={32} 
              className="w-20 sm:w-24 h-auto object-contain" 
            />
          </div>
          <div className="hidden sm:block h-6 w-px bg-gray-200"></div>
          <div className="hidden sm:flex flex-col justify-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
              Active Bulletin
            </span>
            <span className="text-sm font-semibold text-gray-900 leading-none truncate max-w-[120px] md:max-w-[200px]">
              {templateName}
            </span>
          </div>
        </div>

        {/* Center: Timing Metadata */}
        <div className="hidden lg:flex items-center gap-4 bg-gray-900 text-white px-4 py-1.5 rounded-sm shadow-sm border border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Segments</span>
            <span className="text-sm font-heading font-bold tabular-nums">{segmentCount}</span>
          </div>
          <div className="h-4 w-px bg-gray-700"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</span>
            <span className="text-sm font-heading font-bold tabular-nums">{formatDuration(totalDuration)}</span>
          </div>
        </div>

        {/* Right: Profile & Primary CTA */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-gray-900">{userName}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Control Room 1</div>
            </div>
            <div className="w-8 h-8 rounded-sm bg-gray-900 flex items-center justify-center text-white font-bold text-xs shadow-sm border border-gray-800">
              {userInitials}
            </div>
          </div>
          
          {isSessionActive ? (
            <button 
              onClick={async () => {
                // Extract session ID from the pathname /session/[id]
                const sessionId = pathname?.split("/").pop();
                if (sessionId) {
                  try {
                    await fetch(`/api/session/${sessionId}`, {
                      method: "POST",
                      body: JSON.stringify({ action: "end" }),
                    });
                  } catch (e) {
                    console.error("End session failed", e);
                  }
                }
                router.push("/dashboard");
              }}
              className="group flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-900 text-white rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-sm hover:bg-gray-800"
            >
              <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">END SESSION</span>
              <span className="sm:hidden">END</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleStartSession}
                disabled={starting}
                className="group flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-primary text-white rounded-lg text-xs sm:text-sm font-bold tracking-wide transition-all shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {starting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current group-hover:scale-110 transition-transform" />
                )}
                <span className="hidden sm:inline">START SESSION</span>
                <span className="sm:hidden">START</span>
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 sm:py-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg text-xs font-bold transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
