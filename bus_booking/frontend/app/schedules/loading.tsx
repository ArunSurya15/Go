export default function SchedulesLoading() {
  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-neutral-100 dark:bg-neutral-950">
      <div className="container mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="h-24 animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
          <div className="h-64 animate-pulse rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80" />
          <div className="space-y-3">
            {[1, 2, 3].map((k) => (
              <div key={k} className="h-36 animate-pulse rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
