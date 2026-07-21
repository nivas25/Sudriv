import { RunningOrder } from "@/components/session/running-order";

export const metadata = {
  title: "Dashboard — Sudriv",
  description: "Manage your live broadcast running order.",
};

export default function DashboardPage() {
  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-8 md:py-12 space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-heading font-extrabold tracking-tight text-gray-900">
          Running Order Overview
        </h1>
        <p className="text-gray-500 font-sans text-base max-w-2xl">
          Review and prepare your segments before initializing the live production control session.
        </p>
      </div>
      
      <RunningOrder />
    </div>
  );
}
