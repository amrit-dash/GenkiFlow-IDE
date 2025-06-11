
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

  const toggleTheme = () => {
    // Only toggle between light and dark
    // If current theme is system, consider its resolved value for the first toggle.
    // Or, more simply, if it's light or system, go to dark. Otherwise, go to light.
    const currentEffectiveTheme = theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : theme;

    if (currentEffectiveTheme === "light") {
      setTheme("dark")
    } else { // currentEffectiveTheme is "dark"
      setTheme("light")
    }
  }

  if (!mounted) {
    // Render a placeholder or null during server rendering and initial client mount
    return <Button size="icon" variant="ghost" className="rounded-md shadow-lg h-8 w-8 bg-card text-card-foreground border border-border opacity-50 cursor-not-allowed"><Laptop className="h-4 w-4" /></Button>;
  }

  let IconToRender;
  let title;

  // Determine current effective theme for display purposes
  const displayTheme = theme === "system" 
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" 
    : theme;

  if (displayTheme === "light") {
    IconToRender = Sun;
    title = "Switch to Dark Mode";
  } else { // displayTheme is "dark"
    IconToRender = Moon;
    title = "Switch to Light Mode";
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggleTheme}
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
