import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        app: "var(--bg-app)",
        sidebar: "var(--bg-sidebar)",
        topbar: "var(--bg-topbar)",
        elevated: "var(--bg-elevated)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        "chart-1": "hsl(var(--chart-1))",
        "chart-2": "hsl(var(--chart-2))",
        "chart-3": "hsl(var(--chart-3))",
        "chart-4": "hsl(var(--chart-4))",
        "chart-5": "hsl(var(--chart-5))",
        "chart-6": "hsl(var(--chart-6))",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      fontSize: {
        "page-title": ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "card-title": ["13px", { lineHeight: "1.5", fontWeight: "500" }],
        body: ["13px", { lineHeight: "1.5" }],
        caption: ["12px", { lineHeight: "1.5" }],
        micro: ["11px", { lineHeight: "1.4" }],
        "stat-value": ["24px", { lineHeight: "1.25", fontWeight: "600" }],
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Noto Sans SC",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "zoom-in": {
          from: { transform: "translate(-50%, -50%) scale(0.95)" },
          to: { transform: "translate(-50%, -50%) scale(1)" },
        },
        "zoom-out": {
          from: { transform: "translate(-50%, -50%) scale(1)" },
          to: { transform: "translate(-50%, -50%) scale(0.95)" },
        },
        "slide-in-from-top": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-from-bottom": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-10px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "slide-in-from-right": {
          from: { transform: "translateX(10px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.15s ease-in",
        "zoom-in": "zoom-in 0.2s ease-out",
        "zoom-out": "zoom-out 0.15s ease-in",
        "slide-in-from-top": "slide-in-from-top 0.2s ease-out",
        "slide-in-from-bottom": "slide-in-from-bottom 0.2s ease-out",
        "slide-in-from-left": "slide-in-from-left 0.2s ease-out",
        "slide-in-from-right": "slide-in-from-right 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
