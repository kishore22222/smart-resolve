import Button from './ui/Button.jsx';

export default function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
      <Button variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="text-muted">
        Page <span className="font-mono text-fg">{page}</span> of{' '}
        <span className="font-mono text-fg">{pages}</span> · {total} issue{total === 1 ? '' : 's'}
      </span>
      <Button variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={page >= pages}>
        Next
      </Button>
    </div>
  );
}
