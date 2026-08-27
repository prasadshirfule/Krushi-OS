'use client';

import React from 'react';
import { PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  guidanceSteps?: { label: string; href: string }[];
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  guidanceSteps,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-3 text-center">
      <div className="rounded-full bg-muted p-4 mb-1">
        {icon || <PackageOpen className="h-10 w-10 text-muted-foreground/50" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button className="mt-2 bg-green-600 hover:bg-green-700">{actionLabel}</Button>
        </Link>
      )}
      {guidanceSteps && guidanceSteps.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground/70">
          <p className="font-medium mb-1">Getting Started:</p>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {guidanceSteps.map((step, idx) => (
              <React.Fragment key={step.href}>
                <Link href={step.href} className="text-primary underline hover:text-primary/80">
                  {step.label}
                </Link>
                {idx < guidanceSteps.length - 1 && <span className="text-muted-foreground/50">→</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
