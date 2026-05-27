export function Header() {
  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {/* Placeholder for Breadcrumbs / Page Title */}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
          GA
        </div>
      </div>
    </header>
  );
}
