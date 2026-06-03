export function MeshBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full opacity-10 blur-[140px] animate-blob-drift"
        style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[720px] w-[720px] rounded-full opacity-10 blur-[140px] animate-blob-drift-slow"
        style={{ background: "radial-gradient(circle, #ec4899, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-40 left-1/4 h-[680px] w-[680px] rounded-full opacity-10 blur-[140px] animate-blob-drift-reverse"
        style={{ background: "radial-gradient(circle, #a855f7, transparent 70%)" }}
      />
    </div>
  );
}
