export function MeshBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-24 -right-24 h-[500px] w-[500px] rounded-full opacity-[0.08] animate-float"
        style={{ background: "radial-gradient(circle, #7C3AED, transparent 70%)" }}
      />
      <div
        className="absolute top-1/3 -left-32 h-[400px] w-[400px] rounded-full opacity-[0.06] animate-float"
        style={{ animationDelay: "-2s", background: "radial-gradient(circle, #EC4899, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-32 right-1/4 h-[450px] w-[450px] rounded-full opacity-[0.05] animate-float"
        style={{ animationDelay: "-4s", background: "radial-gradient(circle, #3B82F6, transparent 70%)" }}
      />
    </div>
  );
}
