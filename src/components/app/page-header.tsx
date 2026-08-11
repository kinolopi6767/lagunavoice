import type { ReactNode } from "react";

/**
 * Shared premium page header: gradient eyebrow pill, bold title, muted
 * description and an optional action slot (right-aligned).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {eyebrow ? (
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <span className="size-1.5 rounded-full bg-gradient-to-br from-grad-a to-grad-b" />
          {eyebrow}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children ? <div className="flex items-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}
