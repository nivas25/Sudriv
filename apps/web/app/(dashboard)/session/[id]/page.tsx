"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { TimelinePanel } from "@/components/timeline/timeline-panel";
import { TranscriptPanel } from "@/components/transcript/transcript-panel";
import { TeleprompterPanel } from "@/components/teleprompter/teleprompter-panel";
import { MetadataPanel } from "@/components/metadata/metadata-panel";
import { SessionControls } from "@/components/session/session-controls";
import { LiveKitSessionProvider } from "@/components/voice/livekit-session-provider";
import { ListVideo, MessageSquare, MonitorPlay } from "lucide-react";

/**
 * Active Session Page — Control Room View
 * Wrapped in LiveKitSessionProvider for real-time voice connection.
 */
export default function SessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [activeTab, setActiveTab] = useState<"timeline" | "copilot" | "prompter">("copilot");

  return (
    <LiveKitSessionProvider sessionId={sessionId}>
      <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
        {/* Session Control Bar */}
        <SessionControls sessionId={sessionId} />

        {/* Mobile Tabs */}
        <div className="flex lg:hidden items-center border-b border-gray-200 bg-white px-2">
          <button 
            onClick={() => setActiveTab("timeline")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === "timeline" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-900"}`}
          >
            <ListVideo className="w-4 h-4" />
            <span className="hidden sm:inline">Timeline</span>
          </button>
          <button 
            onClick={() => setActiveTab("copilot")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === "copilot" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-900"}`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Copilot</span>
          </button>
          <button 
            onClick={() => setActiveTab("prompter")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === "prompter" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-900"}`}
          >
            <MonitorPlay className="w-4 h-4" />
            <span className="hidden sm:inline">Prompter</span>
          </button>
        </div>

        {/* Main Control Room Layout */}
        <div className="flex-1 lg:grid lg:grid-cols-12 gap-6 p-4 lg:p-6 min-h-0 bg-[#fafcfd]">
          
          {/* Left: Segments / Timeline Panel */}
          <div className={`col-span-3 min-h-0 ${activeTab === "timeline" ? "flex flex-col h-full" : "hidden lg:flex lg:flex-col lg:h-full"}`}>
            <TimelinePanel sessionId={sessionId} />
          </div>

          {/* Center: AI Copilot Transcript Panel */}
          <div className={`col-span-6 min-h-0 ${activeTab === "copilot" ? "flex flex-col h-full" : "hidden lg:flex lg:flex-col lg:h-full"}`}>
            <TranscriptPanel sessionId={sessionId} />
          </div>

          {/* Right: Teleprompter & Metadata Panels */}
          <div className={`col-span-3 min-h-0 lg:flex flex-col gap-6 ${activeTab === "prompter" ? "flex flex-col h-full gap-4" : "hidden"}`}>
            {/* Top Half: Teleprompter */}
            <div className="flex-[1.5] min-h-0 flex flex-col">
              <TeleprompterPanel sessionId={sessionId} />
            </div>
            
            {/* Bottom Half: Active News Metadata */}
            <div className="flex-1 min-h-0 flex flex-col">
              <MetadataPanel sessionId={sessionId} />
            </div>
          </div>

        </div>
      </div>
    </LiveKitSessionProvider>
  );
}
