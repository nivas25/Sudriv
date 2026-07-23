"use client";

import { useState, useEffect } from "react";
import { GripVertical, ChevronDown, Check, Type, Plus, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  _templateId: string | null;
  _position: number;
}

const getBadgeStyle = (type: string) => {
  switch (type) {
    case "LIVE": return "bg-red-600 text-white";
    case "PACKAGE": return "bg-gray-900 text-white";
    case "HEADLINES": return "bg-blue-500 text-white";
    case "BREAK": return "bg-gray-500 text-white";
    case "VTR": return "bg-purple-600 text-white";
    case "GFX": return "bg-teal-500 text-white";
    default: return "bg-gray-200 text-gray-700";
  }
};

function SortableSegmentItem({
  seg,
  isExpanded,
  saving,
  editTitle,
  setEditTitle,
  editType,
  setEditType,
  editDuration,
  setEditDuration,
  editScript,
  setEditScript,
  onExpand,
  onSave,
  onDelete
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: seg.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: isDragging ? "relative" as const : "static" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex flex-col border-b border-gray-100 last:border-0 group ${isDragging ? "opacity-50 bg-gray-50 shadow-md" : "bg-white"}`}>
      {/* Row Header */}
      <div 
        onClick={() => onExpand(isExpanded ? null : seg.id)}
        className={`grid grid-cols-[1fr_auto] sm:grid-cols-[100px_1fr_120px] items-center px-5 sm:px-6 py-5 cursor-pointer transition-colors ${
          isExpanded ? "bg-gray-50/80" : "hover:bg-gray-50/50"
        }`}
      >
        {/* Col 1: Drag & Seq (Desktop) / Title & Badge (Mobile) */}
        <div className="hidden sm:flex items-center justify-center gap-4 text-gray-300 group-hover:text-gray-900 transition-colors">
          <div {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="cursor-grab active:cursor-grabbing p-1 -ml-3 hover:bg-gray-200 rounded transition-colors touch-none">
            <GripVertical className="w-4 h-4 opacity-40 group-hover:opacity-100" />
          </div>
          <span className="font-heading font-bold tabular-nums text-sm -ml-1">
            {seg.order}
          </span>
        </div>
        
        {/* Mobile View Title & Badge */}
        <div className="flex sm:hidden flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="font-heading font-bold text-gray-900 tabular-nums text-sm">
              {seg.order}
            </span>
            <span className={`font-bold text-sm leading-tight ${isExpanded ? "text-primary" : "text-gray-900"}`}>
              {seg.title}
            </span>
          </div>
          <div className="flex items-center gap-3 pl-7">
            <span className={`text-[9px] font-bold py-1 rounded-sm uppercase tracking-widest w-20 text-center inline-block ${getBadgeStyle(seg.type)}`}>
              {seg.type}
            </span>
            <span className="font-heading font-medium text-gray-500 tabular-nums text-xs">
              {seg.duration}
            </span>
          </div>
        </div>
        
        {/* Col 2: Content (Desktop) */}
        <div className="hidden sm:flex items-center gap-4 pl-4 min-w-0">
          <span className={`flex-shrink-0 text-[10px] font-bold py-1 rounded-sm uppercase tracking-widest w-24 text-center inline-block ${getBadgeStyle(seg.type)}`}>
            {seg.type}
          </span>
          <span className={`font-bold text-base truncate ${isExpanded ? "text-primary" : "text-gray-900 group-hover:text-primary transition-colors"}`}>
            {seg.title}
          </span>
        </div>

        {/* Col 3: Controls */}
        <div className="flex items-center justify-end gap-6 pr-2">
          <span className="hidden sm:block font-heading font-medium text-gray-900 tabular-nums text-sm">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-900 font-bold">
                Segment Title
              </label>
              <input 
                type="text" 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-900 font-bold">
                Badge Type
              </label>
              <select 
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm uppercase"
              >
                <option value="package">PACKAGE</option>
                <option value="headlines">HEADLINES</option>
                <option value="live">LIVE</option>
                <option value="break">BREAK</option>
                <option value="vtr">VTR</option>
                <option value="gfx">GFX</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-900 font-bold">
                Estimated Duration
              </label>
              <input 
                type="text" 
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-heading font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-900 font-bold">
              <Type className="w-3.5 h-3.5" />
              Teleprompter Script
            </label>
            <textarea 
              value={editScript}
              onChange={(e) => setEditScript(e.target.value)}
              rows={4}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 font-medium leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm font-sans"
            />
          </div>

          <div className="flex items-center justify-between mt-4 sm:mt-6 pt-4 border-t border-gray-200/60">
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(seg.id); }}
              className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete Segment</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onSave(seg.id); }}
              disabled={saving === seg.id}
              className="flex items-center gap-2 w-full sm:w-auto justify-center px-8 py-2.5 bg-gray-900 text-white hover:bg-gray-800 rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm disabled:opacity-70"
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
  const [editType, setEditType] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    async function loadTemplate() {
      const { data, error } = await supabase
        .from("timelines_library")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (data && data.default_segments && Array.isArray(data.default_segments) && data.default_segments.length > 0) {
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
        window.dispatchEvent(new CustomEvent("timeline_updated", { detail: { name: data.name, segments: loadedSegments } }));
      } else {
        console.info("No timeline template found or it was empty. Seeding demo segments...");
        
        const demoSegments: TemplateSegment[] = [
          {
            position: 1,
            title: "Cold Open & Headlines",
            slug: "headlines",
            segment_type: "headlines",
            duration_seconds: 90,
            teleprompter_text: "Welcome to the broadcast. Here are today's top stories..."
          },
          {
            position: 2,
            title: "Downtown Protest",
            slug: "downtown-protest",
            segment_type: "package",
            duration_seconds: 180,
            teleprompter_text: "Hundreds gathered downtown today to protest the new city ordinance..."
          },
          {
            position: 3,
            title: "Election Update",
            slug: "election-update",
            segment_type: "live",
            duration_seconds: 120,
            teleprompter_text: "We go now live to our reporter at the campaign headquarters..."
          },
          {
            position: 4,
            title: "Commercial Break 1",
            slug: "break-1",
            segment_type: "break",
            duration_seconds: 180,
            teleprompter_text: "(Commercial Break)"
          }
        ];

        let targetTemplateId = data?.id;

        if (data) {
          await supabase
            .from("timelines_library")
            .update({ default_segments: demoSegments })
            .eq("id", data.id);
        } else {
          const { data: newTemplate } = await supabase
            .from("timelines_library")
            .insert({
              name: "Demo Running Order",
              description: "Auto-generated template for demo",
              is_active: true,
              default_segments: demoSegments
            })
            .select()
            .single();
            
          if (newTemplate) {
            targetTemplateId = newTemplate.id;
          }
        }

        if (targetTemplateId) {
          setTemplateId(targetTemplateId);
          const loadedSegments: DisplaySegment[] = demoSegments.map((seg) => ({
            id: `tmp-${seg.position}`,
            order: String(seg.position).padStart(2, "0"),
            title: seg.title,
            type: seg.segment_type.toUpperCase(),
            duration: formatDuration(seg.duration_seconds),
            duration_seconds: seg.duration_seconds,
            script: seg.teleprompter_text || "",
            _templateId: targetTemplateId as string,
            _position: seg.position,
          }));
          setSegments(loadedSegments);
          window.dispatchEvent(new CustomEvent("timeline_updated", { detail: { name: "Demo Running Order", segments: loadedSegments } }));
        }
      }
      setLoading(false);
    }
    loadTemplate();
  }, []);

  useEffect(() => {
    if (expandedId) {
      const seg = segments.find(s => s.id === expandedId);
      if (seg) {
        setEditTitle(seg.title);
        setEditDuration(seg.duration);
        setEditScript(seg.script);
        setEditType(seg.type.toLowerCase());
      }
    }
  }, [expandedId]);

  const handleSave = async (segId: string) => {
    const seg = segments.find(s => s.id === segId);
    if (!seg || !templateId) return;

    setSaving(segId);

    const durationParts = editDuration.split(":");
    let newDurationSeconds = seg.duration_seconds;
    if (durationParts.length === 2) {
      newDurationSeconds = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
    }

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
            segment_type: editType,
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
        const nextSegments = segments.map(s => {
          if (s.id === segId) {
            return {
              ...s,
              title: editTitle,
              type: editType.toUpperCase(),
              duration: formatDuration(newDurationSeconds),
              duration_seconds: newDurationSeconds,
              script: editScript,
            };
          }
          return s;
        });
        setSegments(nextSegments);
        window.dispatchEvent(new CustomEvent("timeline_updated", { detail: { segments: nextSegments } }));
        setExpandedId(null);
      } else {
        console.error("Failed to save:", error);
      }
    }

    setSaving(null);
  };

  const handleAddSegment = async () => {
    if (!templateId) return;
    
    const newPosition = segments.length > 0 ? Math.max(...segments.map(s => s._position)) + 1 : 1;
    
    const newSegment: TemplateSegment = {
      position: newPosition,
      title: "New Segment",
      slug: "new-segment",
      segment_type: "package",
      duration_seconds: 120,
      teleprompter_text: "New Segment\n\n(स्क्रिप्ट उपलब्ध नहीं।)"
    };
    
    const { data: template } = await supabase
      .from("timelines_library")
      .select("default_segments")
      .eq("id", templateId)
      .maybeSingle();
      
    if (template) {
      const updatedSegments = [...(template.default_segments as TemplateSegment[]), newSegment];
      
      const { error } = await supabase
        .from("timelines_library")
        .update({ default_segments: updatedSegments })
        .eq("id", templateId);
        
      if (!error) {
        const addedDisplaySegment: DisplaySegment = {
          id: `tmp-${newSegment.position}-${Date.now()}`,
          order: String(newSegment.position).padStart(2, "0"),
          title: newSegment.title,
          type: newSegment.segment_type.toUpperCase(),
          duration: formatDuration(newSegment.duration_seconds),
          duration_seconds: newSegment.duration_seconds,
          script: newSegment.teleprompter_text,
          _templateId: templateId,
          _position: newSegment.position,
        };
        
        const nextSegments = [...segments, addedDisplaySegment];
        setSegments(nextSegments);
        window.dispatchEvent(new CustomEvent("timeline_updated", { detail: { segments: nextSegments } }));
        setExpandedId(addedDisplaySegment.id);
      } else {
        console.error("Failed to add segment:", error);
      }
    }
  };

  const handleDeleteSegment = async (segId: string) => {
    const seg = segments.find(s => s.id === segId);
    if (!seg || !templateId) return;

    const nextSegments = segments.filter(s => s.id !== segId);
    setSegments(nextSegments);
    window.dispatchEvent(new CustomEvent("timeline_updated", { detail: { segments: nextSegments } }));
    setExpandedId(null);

    const { data: template } = await supabase
      .from("timelines_library")
      .select("default_segments")
      .eq("id", templateId)
      .maybeSingle();

    if (template) {
      const updatedSegments = (template.default_segments as TemplateSegment[]).filter(
        s => s.position !== seg._position
      );
      
      const { error } = await supabase
        .from("timelines_library")
        .update({ default_segments: updatedSegments })
        .eq("id", templateId);

      if (error) {
        console.error("Failed to delete segment from DB:", error);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id && over) {
      const oldIndex = segments.findIndex((s) => s.id === active.id);
      const newIndex = segments.findIndex((s) => s.id === over.id);
      
      // Reorder visually first
      const newSegmentsOrder = arrayMove(segments, oldIndex, newIndex);
      
      // Re-map internal order numbering to keep it sequential (1, 2, 3...)
      const renumberedSegments = newSegmentsOrder.map((seg, idx) => ({
        ...seg,
        _position: idx + 1,
        order: String(idx + 1).padStart(2, "0")
      }));
      
      setSegments(renumberedSegments);
      window.dispatchEvent(new CustomEvent("timeline_updated", { detail: { segments: renumberedSegments } }));

      // Save to database
      if (!templateId) return;

      const { data: template } = await supabase
        .from("timelines_library")
        .select("default_segments")
        .eq("id", templateId)
        .maybeSingle();
        
      if (template && Array.isArray(template.default_segments)) {
        // We have the raw default_segments, we need to reorder them to match the new visual order
        const newDbSegments = renumberedSegments.map((visualSeg) => {
          return {
            position: visualSeg._position,
            title: visualSeg.title,
            slug: `seg-${visualSeg._position}`, // fallback slug
            segment_type: visualSeg.type.toLowerCase(),
            duration_seconds: visualSeg.duration_seconds,
            teleprompter_text: visualSeg.script
          };
        });

        await supabase
          .from("timelines_library")
          .update({ default_segments: newDbSegments })
          .eq("id", templateId);
      }
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
    <div className="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Table Header (Hidden on mobile) */}
      <div className="hidden sm:grid grid-cols-[100px_1fr_120px] items-center px-6 py-4 border-b border-gray-200 text-[11px] font-bold text-gray-900 uppercase tracking-[0.2em] bg-gray-50/50">
        <div className="text-center">SEQ</div>
        <div className="pl-4">SEGMENT DETAILS</div>
        <div className="text-right pr-14">EST. TIME</div>
      </div>

      {/* Segment List */}
      <div className="flex flex-col bg-white">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={segments.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {segments.map((seg) => (
              <SortableSegmentItem
                key={seg.id}
                seg={seg}
                isExpanded={expandedId === seg.id}
                saving={saving}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
                editType={editType}
                setEditType={setEditType}
                editDuration={editDuration}
                setEditDuration={setEditDuration}
                editScript={editScript}
                setEditScript={setEditScript}
                onExpand={setExpandedId}
                onSave={handleSave}
                onDelete={handleDeleteSegment}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add Segment Button */}
        <div className="p-4 sm:p-6 bg-white border-t border-gray-100 rounded-b-xl">
          <div 
            onClick={handleAddSegment}
            className="flex items-center justify-center py-4 bg-gray-50/50 hover:bg-gray-50 border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-xl transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-600 transition-colors font-bold text-xs tracking-wider uppercase">
              <Plus className="w-4 h-4" />
              Add New Segment
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
