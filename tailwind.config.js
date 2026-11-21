/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "selector",
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  safelist: ["dark"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
      },
      screens: {
        lg: "1060px",
      },
    },
    extend: {
      fontFamily: {
        display: [
          '"Fredoka"',
          '"Nunito"',
          "ui-rounded",
          "system-ui",
          "sans-serif",
        ],
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        ink: "hsl(var(--ink))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        screen: "hsl(var(--surface-screen))",
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
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        toy: "0 4px 0 0 var(--shadow-ink)",
        "toy-sm": "0 2.5px 0 0 var(--shadow-ink)",
        "toy-xs": "0 1.5px 0 0 var(--shadow-ink)",
        "toy-lg": "0 6px 0 0 var(--shadow-ink)",
        "toy-inset": "inset 0 2px 0 0 rgba(0, 0, 0, 0.08)",
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
        "cell-pop": {
          "0%": { transform: "scale(0.76)" },
          "60%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
        "cell-wobble": {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-4px) rotate(-2deg)" },
          "45%": { transform: "translateX(4px) rotate(2deg)" },
          "70%": { transform: "translateX(-2.5px)" },
          "85%": { transform: "translateX(2px)" },
        },
        "countdown-pop": {
          "0%": { transform: "scale(0.55)", opacity: "0" },
          "65%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "banner-pop": {
          "0%": { transform: "scale(0.92) translateY(8px)", opacity: "0" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        "sparkle-float": {
          "0%, 100%": { transform: "translateY(0) scale(1)", opacity: "0.95" },
          "50%": { transform: "translateY(-4px) scale(1.12)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "cell-pop": "cell-pop 140ms cubic-bezier(0.22, 1.4, 0.36, 1)",
        "cell-wobble": "cell-wobble 220ms ease-in-out",
        "countdown-pop": "countdown-pop 180ms cubic-bezier(0.22, 1.35, 0.36, 1)",
        "banner-pop": "banner-pop 180ms cubic-bezier(0.22, 1.25, 0.36, 1)",
        "sparkle-float": "sparkle-float 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
