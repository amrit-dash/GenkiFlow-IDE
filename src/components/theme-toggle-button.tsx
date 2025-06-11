
"use client"

import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ThemeToggleButton() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark")
    } else if (theme === "dark") {
      setTheme("system")
    } else {
      setTheme("light")
    }
  }

  if (!mounted) {
    // Render a placeholder or null during server rendering and initial client mount
    return <Button size="icon" variant="ghost" className="rounded-md shadow-lg h-8 w-8 bg-card text-card-foreground border border-border opacity-50 cursor-not-allowed"><Laptop className="h-4 w-4" /></Button>;
  }

  let IconToRender;
  let title = "Toggle theme";

  if (theme === "light") {
    IconToRender = Sun;
    title = "Switch to Dark Mode";
  } else if (theme === "dark") {
    IconToRender = Moon;
    title = "Switch to System Preference";
  } else { // system
    IconToRender = Laptop;
    title = "Switch to Light Mode";
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={cycleTheme}
      title={title}
      className={cn(
        "rounded-md shadow-lg h-8 w-8", // Standardized size
        "bg-card text-card-foreground border border-border hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <IconToRender className="h-4 w-4" />
      <span className="sr-only">{title}</span>
    </Button>
  )
}
