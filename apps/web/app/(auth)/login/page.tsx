import { LoginForm } from "@/components/auth/login-form";
import Image from "next/image";

export const metadata = {
  title: "Sign In — Sudriv",
  description: "Sign in to Sudriv.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafcfd] p-4 relative overflow-hidden">
      {/* Extremely subtle background gradient for premium depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#fafcfd] to-[#fafcfd] -z-10" />
      
      <div className="w-full max-w-[400px] flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        {/* Prominent Logo */}
        <div className="mb-12">
          <Image
            src="/logo.png"
            alt="Sudriv Logo"
            width={240}
            height={80}
            className="w-48 sm:w-56 h-auto object-contain drop-shadow-sm"
            priority
          />
        </div>

        {/* Minimal text */}
        <div className="w-full text-center mb-8 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 font-heading">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 font-sans">
            Please enter your details to sign in.
          </p>
        </div>

        {/* Form */}
        <div className="w-full bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
          <LoginForm />
        </div>
      </div>
      
      {/* Simple Footer */}
      <div className="absolute bottom-8 text-center animate-in fade-in duration-1000 delay-300">
        <p className="text-xs text-gray-400 font-sans tracking-wide">
          &copy; {new Date().getFullYear()} SUDRIV INC.
        </p>
      </div>
    </div>
  );
}
