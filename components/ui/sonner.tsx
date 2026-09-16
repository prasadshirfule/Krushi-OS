"use client"

import {
  CheckCircle2,
  Info,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group font-sans"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans rounded-xl text-sm border shadow-xl transition-all duration-200 " +
            "bg-background/95 text-foreground border-border/80 " +
            "dark:bg-zinc-900/90 dark:text-zinc-100 dark:border-white/10 dark:shadow-black/50 " +
            "backdrop-blur-md px-4 py-3 gap-3 max-w-[380px] w-full sm:w-auto",
          title: "font-semibold text-sm tracking-tight text-foreground dark:text-zinc-100",
          description: "text-xs text-muted-foreground mt-0.5 leading-relaxed font-normal dark:text-zinc-400",
          actionButton: "bg-primary text-primary-foreground font-medium text-xs px-3 py-1.5 rounded-lg shadow-sm hover:opacity-90 transition-opacity",
          cancelButton: "bg-muted text-muted-foreground font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-muted/80 transition-colors",
          closeButton: "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full",
          success: "!border-emerald-500/30 dark:!border-emerald-500/25 !bg-emerald-950/20 dark:!bg-emerald-950/30",
          error: "!border-rose-500/30 dark:!border-rose-500/25 !bg-rose-950/20 dark:!bg-rose-950/30",
          warning: "!border-amber-500/30 dark:!border-amber-500/25 !bg-amber-950/20 dark:!bg-amber-950/30",
          info: "!border-blue-500/30 dark:!border-blue-500/25 !bg-blue-950/20 dark:!bg-blue-950/30",
        },
      }}
      icons={{
        success: <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />,
        info: <Info className="size-4 text-blue-400 shrink-0" />,
        warning: <AlertTriangle className="size-4 text-amber-500 shrink-0" />,
        error: <AlertCircle className="size-4 text-rose-500 shrink-0" />,
        loading: <Loader2 className="size-4 animate-spin text-primary shrink-0" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
