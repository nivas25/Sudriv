"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Mic, User, Cpu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function TranscriptPanel({ sessionId }: { sessionId: string }) {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (sessionId === "demo") return;

    const fetchEvents = async () => {
      const { data } = await supabase
        .from("session_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      
      if (data) {
        setMessages(data.map(event => ({
          id: event.id,
          role: event.source === "agent" ? "ai" : "human",
          text: event.payload?.text || "Unknown event"
        })));
      }
    };

    fetchEvents();

    const channel = supabase
      .channel(`transcript-${sessionId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "session_events",
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        const event = payload.new;
        setMessages(prev => [...prev, {
          id: event.id,
          role: event.source === "agent" ? "ai" : "human",
          text: event.payload?.text || "Unknown event"
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-gray-400" />
          <h2 className="font-heading font-bold text-lg text-gray-900 tracking-tight">AI Copilot Feed</h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-emerald-600 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Active</span>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/30">
        {messages.length === 0 ? (
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center py-8">
            No events yet.
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-4 max-w-[85%] ${msg.role === "human" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-sm border-2 ${
                    msg.role === "human" 
                      ? "bg-primary text-white border-primary shadow-sm" 
                      : "bg-gray-900 text-white border-gray-900 shadow-sm"
                  }`}>
                    {msg.role === "human" ? <User className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                  </div>
                </div>
                
                {/* Bubble */}
                <div className={`flex flex-col ${msg.role === "human" ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    {msg.role === "human" ? "Producer" : "Sudriv AI"}
                  </span>
                  <div className={`px-5 py-3.5 border shadow-sm ${
                    msg.role === "human"
                      ? "bg-white border-primary/20 text-gray-900 rounded-2xl rounded-tr-sm"
                      : "bg-white border-gray-200 text-gray-900 rounded-2xl rounded-tl-sm"
                  }`}>
                    <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Voice Control Area */}
      <div className="p-4 sm:p-6 bg-white border-t border-gray-100 flex flex-col items-center justify-center gap-3">
        <button 
          onClick={() => setIsListening(!isListening)}
          className={`flex items-center justify-center w-16 h-16 rounded-full shadow-lg transition-all duration-300 active:scale-95 group relative ${
            isListening 
              ? "bg-primary text-white shadow-primary/30" 
              : "bg-gray-900 text-white hover:scale-105 hover:bg-gray-800"
          }`}
        >
          {isListening && (
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-75"></div>
          )}
          {isListening ? (
             <div className="w-5 h-5 rounded-sm bg-white" />
          ) : (
             <Mic className="w-6 h-6" />
          )}
        </button>
        <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isListening ? "text-primary animate-pulse" : "text-gray-400"}`}>
          {isListening ? "Listening..." : "Tap to Speak"}
        </span>
      </div>
    </div>
  );
}
