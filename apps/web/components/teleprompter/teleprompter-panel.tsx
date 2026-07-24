export function TeleprompterPanel({ sessionId }: { sessionId: string }) {
  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Teleprompter</h2>
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Prompter coming soon...
      </div>
    </div>
  );
}
