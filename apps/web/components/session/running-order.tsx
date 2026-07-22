"use client";

import { useState, useEffect } from "react";
import { GripVertical, ChevronDown, Check, Type, Plus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";

interface TemplateSegment {
  position: number;
  title: string;
  slug: string;
  segment_type: string;
  duration_seconds: number;
  teleprompter_text: string;
}

interface DisplaySegment {
  id: string;
  order: string;
  title: string;
  type: string;
  duration: string;
  duration_seconds: number;
  script: string;
  // Track which template this belongs to for saving
  _templateId: string | null;
  _position: number;
}

export function RunningOrder() {
  const [segments, setSegments] = useState<DisplaySegment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const supabase = createClient();

  // Edit state for the expanded segment
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editScript, setEditScript] = useState("");

  useEffect(() => {
    async function loadTemplate() {
      const { data, error } = await supabase
        .from("timelines_library")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
        
      if (data && data.default_segments) {
        setTemplateId(data.id);
        const loadedSegments: DisplaySegment[] = (data.default_segments as TemplateSegment[]).map((seg) => ({
          id: `tmp-${seg.position}`,
          order: String(seg.position).padStart(2, "0"),
          title: seg.title,
          type: seg.segment_type.toUpperCase(),
          duration: formatDuration(seg.duration_seconds),
          duration_seconds: seg.duration_seconds,
          script: seg.teleprompter_text || "",
          _templateId: data.id,
          _position: seg.position,
        }));
        setSegments(loadedSegments);
      } else {
        console.error("Failed to load timeline template", error);
      }
      setLoading(false);
    }
    loadTemplate();
  }, []);

  // When a segment is expanded, populate edit fields
  useEffect(() => {
    if (expandedId) {
      const seg = segments.find(s => s.id === expandedId);
      if (seg) {
        setEditTitle(seg.title);
        setEditDuration(seg.duration);
        setEditScript(seg.script);
      }
    }
  }, [expandedId]);

  const handleSave = async (segId: string) => {
    const seg = segments.find(s => s.id === segId);
    if (!seg || !templateId) return;

    setSaving(segId);

    // Parse duration string back to seconds (MM:SS)
    const durationParts = editDuration.split(":");
    let newDurationSeconds = seg.duration_seconds;
    if (durationParts.length === 2) {
      newDurationSeconds = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
    }

    // Reload template, update the specific segment in default_segments, and save back
    const { data: template } = await supabase
      .from("timelines_library")
      .select("default_segments")
      .eq("id", templateId)
      .maybeSingle();

    if (template) {
      const updatedSegments = (template.default_segments as TemplateSegment[]).map((s) => {
        if (s.position === seg._position) {
          return {
            ...s,
            title: editTitle,
            duration_seconds: newDurationSeconds,
            teleprompter_text: editScript,
          };
        }
        return s;
      });

      const { error } = await supabase
        .from("timelines_library")
        .update({ default_segments: updatedSegments })
        .eq("id", templateId);

      if (!error) {
        // Update local state
        setSegments(prev => prev.map(s => {
          if (s.id === segId) {
            return {
              ...s,
              title: editTitle,
              duration: formatDuration(newDurationSeconds),
              duration_seconds: newDurationSeconds,
              script: editScript,
            };
          }
          return s;
        }));
        setExpandedId(null);
      } else {
        console.error("Failed to save:", error);
      }
    }

    setSaving(null);
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "LIVE": return "bg-primary text-white border-primary";
      case "VTR": return "bg-gray-900 text-white border-gray-900";
      case "PKG": return "bg-white text-gray-900 border-gray-900";
      case "GFX": return "bg-gray-50 text-gray-600 border-gray-300";
      case "HEADLINES": return "bg-blue-500 text-white border-blue-500";
      case "BREAK": return "bg-gray-500 text-white border-gray-500";
      case "PACKAGE": return "bg-gray-900 text-white border-gray-900";
      default: return "bg-white text-gray-500 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="w-full flex justify-center items-center h-64 bg-white rounded-3xl border border-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-white rounded-3xl p-4 sm:p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
      {/* Table Header (Hidden on mobile) */}
      <div className="hidden sm:grid grid-cols-[auto_1fr_auto] items-center px-6 py-4 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.2em] bg-gray-50/50 rounded-t-xl">
        <div className="flex items-center gap-6 w-20 md:w-24">
          <span>Seq</span>
        </div>
        <div className="pl-2 md:pl-4">Segment Details</div>
        <div className="pr-2 md:pr-4">Est. Time</div>
      </div>

      {/* Segment List */}
      <div className="flex flex-col border border-gray-100 sm:border-t-0 rounded-xl sm:rounded-t-none sm:rounded-b-xl overflow-hidden bg-white">
        {segments.map((seg) => {
          const isExpanded = expandedId === seg.id;

          return (
            <div key={seg.id} className="flex flex-col border-b border-gray-100 last:border-0 group">
              {/* Row Header */}
              <div 
                onClick={() => setExpandedId(isExpanded ? null : seg.id)}
                className={`flex items-start sm:grid sm:grid-cols-[auto_1fr_auto] gap-4 sm:gap-0 px-5 sm:px-6 py-5 cursor-pointer transition-colors ${
                  isExpanded ? "bg-gray-50/80" : "hover:bg-gray-50/50"
                }`}
              >
                {/* Col 1: Drag & Seq */}
                <div className="flex items-center gap-3 w-16 sm:w-20 md:w-24 mt-0.5 sm:mt-0 shrink-0">
                  <GripVertical className="w-5 h-5 text-gray-300 group-hover:text-gray-900 cursor-grab active:cursor-grabbing transition-colors -ml-1" />
                  <span className="font-heading font-bold text-gray-400 group-hover:text-gray-900 tabular-nums text-sm transition-colors">
                    {seg.order}
                  </span>
                </div>
                
                {/* Col 2: Content */}
                <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center min-w-0 pr-2">
                  {/* Title */}
                  <span className={`font-semibold text-sm sm:text-base leading-relaxed sm:leading-tight order-1 sm:order-2 ${isExpanded ? "text-primary" : "text-gray-900 group-hover:text-primary transition-colors"}`}>
                    {seg.title}
                  </span>
                  
                  {/* Mobile-only Subtitle (Badge + Duration) */}
                  <div className="flex items-center gap-4 order-2 sm:hidden mt-2.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm border-[1.5px] uppercase tracking-widest ${getBadgeStyle(seg.type)}`}>
                      {seg.type}
                    </span>
                    <span className="font-heading font-medium text-gray-500 tabular-nums text-xs">
                      {seg.duration}
                    </span>
                  </div>

                  {/* Desktop-only Badge */}
                  <span className={`hidden sm:flex order-1 text-[10px] font-bold px-2 py-0.5 rounded-sm border-2 uppercase tracking-widest sm:mr-5 ${getBadgeStyle(seg.type)}`}>
                    {seg.type}
                  </span>
                </div>

                {/* Col 3: Controls */}
                <div className="flex flex-col justify-start items-end sm:flex-row sm:items-center gap-4 md:gap-6 shrink-0 mt-0.5 sm:mt-0">
                  {/* Desktop-only Duration */}
                  <span className="hidden sm:inline-block font-heading font-medium text-gray-900 tabular-nums text-sm">
                    {seg.duration}
                  </span>
                  <button className="text-gray-400 bg-white border border-gray-200 shadow-sm p-2 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors">
                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Expanded Inline Editor */}
              {isExpanded && (
                <div className="px-4 sm:px-6 md:px-14 pb-6 sm:pb-8 pt-4 bg-gray-50/50 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                        Segment Title
                      </label>
                      <input 
                        type="text" 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                        Estimated Duration
                      </label>
                      <input 
                        type="text" 
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-heading tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                      <Type className="w-3.5 h-3.5" />
                      Teleprompter Script
                    </label>
                    <textarea 
                      value={editScript}
                      onChange={(e) => setEditScript(e.target.value)}
                      rows={3}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm font-sans"
                    />
                  </div>

                  <div className="flex justify-end mt-4 sm:mt-6">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSave(seg.id); }}
                      disabled={saving === seg.id}
                      className="flex items-center gap-2 w-full sm:w-auto justify-center px-6 py-2.5 bg-gray-900 text-white hover:bg-gray-800 rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm disabled:opacity-70"
                    >
                      {saving === seg.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Save Changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Segment Button */}
        <div className="flex items-center justify-center p-4 sm:p-5 bg-gray-50/50 hover:bg-primary/5 transition-colors cursor-pointer group border-t border-gray-100">
          <div className="flex items-center gap-2 text-gray-400 group-hover:text-primary transition-colors font-bold text-xs tracking-wider uppercase">
            <Plus className="w-4 h-4" />
            Add New Segment
          </div>
        </div>
      </div>
    </div>
  );
}
