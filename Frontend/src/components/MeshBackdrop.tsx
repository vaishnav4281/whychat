export function MeshBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-48 -right-48 h-[600px] w-[600px] rounded-full opacity-[0.03]"
        style={{ background: "radial-gradient(circle, #0071E3, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full opacity-[0.02]"
        style={{ background: "radial-gradient(circle, #0071E3, transparent 70%)" }}
      />
    </div>
  );
}
