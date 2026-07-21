"use client";

import { useState } from "react";
import { Clock, List, Radio, Play } from "lucide-react";
import { useRouter } from "next/navigation";

// Template data
const TEMPLATES = [
  { id: "t1", name: "Morning Bulletin", desc: "Standard 30-minute morning news with weather and sports", duration: "30 min", segments: 8, category: "General" },
  { id: "t2", name: "Breaking News: Earthquake", desc: "Developing earthquake story with live updates and dynamic timeline", duration: "45 min", segments: 6, category: "Breaking" },
  { id: "t3", name: "Election Night Special", desc: "60-minute election results coverage with multi-anchor setup", duration: "60 min", segments: 12, category: "Special" },
  { id: "t4", name: "Evening Prime", desc: "Standard evening prime-time news with detailed analytics", duration: "30 min", segments: 10, category: "General" },
];

export function SessionSetup() {
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();

  const handleStart = () => {
    if (!selected) return;
    // MVP: Route to a session page (we'll implement the actual route later)
    router.push(`/dashboard`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Radio className="w-5 h-5 text-primary" />
          Available Timelines
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-300 border ${
              selected === t.id 
                ? "bg-primary/5 border-primary shadow-sm shadow-primary/10 ring-1 ring-primary" 
                : "bg-gray-50/50 border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1">
                <h3 className={`font-bold text-base ${selected === t.id ? "text-primary" : "text-gray-900"}`}>
                  {t.name}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed pr-6">{t.desc}</p>
              </div>
              <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${
                t.category === "Breaking" 
                  ? "bg-red-100 text-red-700" 
                  : "bg-gray-200 text-gray-700"
              }`}>
                {t.category}
              </span>
            </div>
            
            <div className="flex items-center gap-5 mt-5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{t.duration}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <List className="w-3.5 h-3.5" />
                <span>{t.segments} Segments</span>
              </div>
            </div>
            
            {/* Selection indicator */}
            {selected === t.id && (
              <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-6 border-t border-gray-100">
        <button
          onClick={handleStart}
          disabled={!selected}
          className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all ${
            selected 
              ? "bg-primary text-white shadow-sm shadow-primary/20 hover:shadow-md hover:bg-primary/90 hover:shadow-primary/30" 
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          ENTER CONTROL ROOM
        </button>
      </div>
    </div>
  );
}
