export function MeshBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-48 -left-48 h-[800px] w-[800px] rounded-full opacity-[0.08] blur-[160px] animate-blob-drift"
        style={{ background: "radial-gradient(circle at 30% 30%, oklch(0.65 0.3 285), oklch(0.5 0.3 310) 50%, transparent 80%)" }}
      />
      <div
        className="absolute top-1/4 -right-48 h-[900px] w-[900px] rounded-full opacity-[0.06] blur-[160px] animate-blob-drift-slow"
        style={{ background: "radial-gradient(circle at 70% 70%, oklch(0.7 0.25 340), oklch(0.55 0.25 310) 50%, transparent 80%)" }}
      />
      <div
        className="absolute -bottom-48 left-1/3 h-[750px] w-[750px] rounded-full opacity-[0.07] blur-[160px] animate-blob-drift-reverse"
        style={{ background: "radial-gradient(circle at 40% 60%, oklch(0.5 0.22 260), oklch(0.6 0.26 285) 50%, transparent 80%)" }}
      />
      <div
        className="absolute top-2/3 left-1/6 h-[500px] w-[500px] rounded-full opacity-[0.05] blur-[120px] animate-blob-drift-accent"
        style={{ background: "radial-gradient(circle at 50% 50%, oklch(0.75 0.2 45), transparent 70%)" }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full opacity-[0.04] blur-[100px] animate-blob-drift-slow"
        style={{ background: "radial-gradient(circle at 50% 50%, oklch(0.65 0.22 30), transparent 70%)" }}
      />
    </div>
  );
}
