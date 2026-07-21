import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Sudriv — Live Broadcast Management",
  description: "Real-time timeline management for production control rooms.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fafcfd] relative overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
      {/* Extremely subtle background gradient for premium depth matching login page */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#fafcfd] to-[#fafcfd] -z-10" />

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-4xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
          
          {/* The Beauty: Massive Logo centered perfectly */}
          <div className="mb-16">
            <Image
              src="/logo.png"
              alt="Sudriv Logo"
              width={800}
              height={260}
              className="w-72 sm:w-96 md:w-[480px] h-auto object-contain drop-shadow-sm"
              priority
            />
          </div>

          {/* Premium UI Container (matching the login form's aesthetic container style) */}
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col items-center text-center max-w-2xl w-full">
            <h1 className="text-3xl md:text-4xl lg:text-[40px] font-heading font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
              Control the{" "}
              <span className="relative inline-block px-3">
                <span className="absolute inset-0 bg-primary/10 rounded-lg transform -skew-x-[8deg] -z-10"></span>
                <span className="relative text-primary">Chaos.</span>
              </span>
            </h1>
            <p className="text-sm md:text-base text-gray-500 font-sans leading-relaxed mb-10 max-w-lg">
              The voice-controlled timeline management system built exclusively for live broadcast production control rooms.
            </p>

            <Link 
              href="/login" 
              className="group flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-3.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30"
            >
              <span>Access Workspace</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </main>

      {/* Simple Footer matching login page */}
      <div className="w-full text-center pb-8 animate-in fade-in duration-1000 delay-300">
        <p className="text-[11px] font-semibold text-gray-400 font-sans tracking-widest uppercase">
          &copy; {new Date().getFullYear()} SUDRIV INC.
        </p>
      </div>
    </div>
  );
}
