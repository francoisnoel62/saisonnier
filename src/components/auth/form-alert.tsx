import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"

// Message de formulaire : une erreur est annoncée immédiatement, une confirmation poliment.
export function FormAlert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success"
  children: React.ReactNode
}) {
  const Icon = variant === "error" ? CircleAlertIcon : CircleCheckIcon

  return (
    <Alert
      variant={variant === "error" ? "destructive" : "default"}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
