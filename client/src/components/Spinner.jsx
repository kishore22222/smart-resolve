export default function Spinner({ label = 'Loading', className }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <div className="mx-auto my-6 h-7 w-7 animate-spinner rounded-full border-[3px] border-line border-t-blue motion-reduce:animate-none" />
      <span className="mt-3 block text-center text-xs text-dim">{label}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
