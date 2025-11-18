import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface LoadingSpinnerProps {
  className?: string
  message?: string
}

export function LoadingSpinner({ className, message }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  )
}
