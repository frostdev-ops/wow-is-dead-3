# Admin Panel Design System

## Design Philosophy: **Modern Minimal Professional**

A clean, professional interface inspired by Linear and Vercel, emphasizing:
- **Clarity**: Clear information hierarchy with ample whitespace
- **Smoothness**: Subtle, purposeful animations that enhance UX
- **Consistency**: Unified color palette and spacing system
- **Adaptability**: Proper dark/light mode support
- **Performance**: Lightweight animations that don't sacrifice speed

---

## Color System

### Semantic Colors (HSL)
```css
/* Primary - Indigo/Blue */
--primary: 217.2 91.2% 59.8%
--primary-foreground: 222.2 47.4% 11.2%

/* Secondary - Purple */
--secondary: 270 50% 40%
--secondary-foreground: 210 40% 98%

/* Success - Green */
--success: 142.1 76.2% 36.3%
--success-foreground: 355.7 100% 97.3%

/* Warning - Amber */
--warning: 38 92% 50%
--warning-foreground: 48 96% 89%

/* Danger - Red */
--danger: 0 84.2% 60.2%
--danger-foreground: 0 0% 100%

/* Neutral - Slate */
--muted: 217.2 32.6% 17.5%
--muted-foreground: 215 20.2% 65.1%

--accent: 217.2 32.6% 17.5%
--accent-foreground: 210 40% 98%
```

### Usage Rules
- **NEVER** use hardcoded color values (`#007bff`, `bg-blue-600`, etc.)
- **ALWAYS** use semantic tokens: `bg-primary`, `text-success`, `border-muted`
- **Gradients**: Only on marketing pages or hero sections, not in data tables
- **Backgrounds**: Use `bg-background`, `bg-card`, `bg-muted` only

---

## Typography

### Scale
```
text-xs   → 0.75rem (12px)  → Captions, labels
text-sm   → 0.875rem (14px) → Body small, metadata
text-base → 1rem (16px)     → Body text, default
text-lg   → 1.125rem (18px) → Subheadings
text-xl   → 1.25rem (20px)  → Section headers
text-2xl  → 1.5rem (24px)   → Page titles
text-3xl  → 1.875rem (30px) → Hero titles
```

### Weights
- `font-normal` (400): Body text
- `font-medium` (500): Emphasized text, labels
- `font-semibold` (600): Headings, buttons
- `font-bold` (700): Reserved for special emphasis

---

## Spacing System

**Use Tailwind's default scale consistently:**
```
gap-1, gap-2, gap-3, gap-4, gap-6, gap-8, gap-12
p-2, p-4, p-6, p-8
m-2, m-4, m-6, m-8
```

**Common Patterns:**
- Card padding: `p-6` (default), `p-8` (large cards)
- Section gaps: `gap-6` (list items), `gap-8` (sections)
- Page margins: `p-6 md:p-8`

**NEVER** use arbitrary values like `p-[17px]` unless absolutely necessary.

---

## Shadows

**3-Level System:**
```
shadow-sm  → Subtle elevation (cards, inputs)
shadow-md  → Medium elevation (dropdowns, popovers)
shadow-lg  → High elevation (modals, dialogs)
```

**NEVER** use custom box-shadow CSS. Use Tailwind classes.

---

## Border Radius

**3-Level System:**
```
rounded-md  → 0.375rem (6px)  → Default (buttons, inputs, small cards)
rounded-lg  → 0.5rem (8px)    → Cards, panels
rounded-xl  → 0.75rem (12px)  → Modals, large containers
```

---

## Animation Principles

### Timing
- **Fast**: 150ms - Hover states, toggles
- **Medium**: 200-300ms - Modals, dropdowns, tabs
- **Slow**: 400-500ms - Page transitions, large movements

### Easing
- **Ease Out**: Use for elements entering (spring, ease-out)
- **Ease In**: Use for elements exiting (ease-in)
- **Ease In-Out**: Use for moving between states

### Framer Motion Patterns

**Button Press:**
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.15 }}
>
```

**Card Hover:**
```tsx
<motion.div
  whileHover={{ y: -2, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
  transition={{ duration: 0.2 }}
>
```

**Modal Enter/Exit:**
```tsx
<AnimatePresence>
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
  >
</AnimatePresence>
```

**Tab Transitions:**
```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={activeTab}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    transition={{ duration: 0.2 }}
  >
</AnimatePresence>
```

**Stagger Children:**
```tsx
<motion.div
  variants={{
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }}
  initial="hidden"
  animate="show"
>
  {items.map(item => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
      }}
    >
  ))}
</motion.div>
```

---

## Component Patterns

### Buttons
- Use CVA variants from `components/ui/button.tsx`
- Variants: default, destructive, outline, secondary, ghost, link
- Sizes: default, sm, lg, icon
- Always include Framer Motion `whileHover` and `whileTap`

### Cards
- Default: `bg-card rounded-lg border border-border shadow-sm p-6`
- Interactive: Add hover animation with `motion.div`
- No hardcoded backgrounds

### Inputs
- Use consistent styling: `border border-input bg-background`
- Focus state: `focus:ring-2 focus:ring-ring`
- Never use custom CSS focus styles

### Loading States
- Use `Skeleton` component from `components/ui/skeleton.tsx`
- Match skeleton dimensions to actual content
- Animate skeleton shimmer effect

---

## Dark/Light Mode

### Implementation
- Use Tailwind's `dark:` variant
- Toggle via context/store
- Persist to localStorage
- Respect `prefers-color-scheme`

### Color Variables (Light Mode)
```css
--background: 0 0% 100%
--foreground: 222.2 84% 4.9%
--card: 0 0% 100%
--card-foreground: 222.2 84% 4.9%
--primary: 217.2 91.2% 59.8%
```

### Color Variables (Dark Mode)
```css
--background: 222.2 84% 4.9%
--foreground: 210 40% 98%
--card: 222.2 84% 4.9%
--card-foreground: 210 40% 98%
--primary: 217.2 91.2% 59.8%
```

---

## Page Layouts

### Standard Page Structure
```tsx
<div className="flex-1 overflow-auto">
  <div className="p-6 md:p-8 max-w-7xl mx-auto">
    <h1 className="text-2xl font-semibold mb-6">Page Title</h1>
    <div className="grid gap-6">
      {/* Content */}
    </div>
  </div>
</div>
```

### Stats Grid (Dashboard)
```tsx
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-card rounded-lg border border-border p-6"
  >
    {/* Stat content */}
  </motion.div>
</div>
```

---

## Accessibility

- All buttons have proper ARIA labels
- Focus visible states: `focus-visible:ring-2 focus-visible:ring-ring`
- Keyboard navigation support
- Proper heading hierarchy (h1 → h2 → h3)
- Color contrast ratio ≥ 4.5:1

---

## Migration Checklist

### Files to Delete
- [ ] `src/App.css` - Replace with Tailwind
- [ ] `src/components/FileBrowser.css` - Migrate to inline Tailwind
- [ ] `src/components/CommandPalette.css` - Migrate to inline Tailwind

### Files to Refactor
- [ ] All pages: Remove hardcoded color classes
- [ ] All components: Add Framer Motion animations
- [ ] Button component: Add whileHover/whileTap
- [ ] Card components: Add hover animations
- [ ] Tab components: Add AnimatePresence transitions

### New Features
- [ ] Dark/light mode toggle
- [ ] Theme context provider
- [ ] Page transition wrapper
- [ ] Skeleton loading states
- [ ] Consistent spacing throughout

---

## Examples

### ✅ Good
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  className="bg-primary text-primary-foreground rounded-md px-4 py-2"
>
  Click me
</motion.button>
```

### ❌ Bad
```tsx
<button
  className="bg-blue-600 text-white rounded-md px-4 py-2"
  style={{ backgroundColor: '#007bff' }}
>
  Click me
</button>
```

---

## Resources

- **Tailwind Docs**: https://tailwindcss.com/docs
- **Framer Motion**: https://www.framer.com/motion/
- **Radix UI**: https://www.radix-ui.com/
- **CVA**: https://cva.style/
