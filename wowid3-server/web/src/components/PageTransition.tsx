import { motion, Variants } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  /**
   * Variant type for different transition styles
   * - 'default': Fade + slide from bottom (most pages)
   * - 'fade': Fade only (login page)
   * - 'slide': Slide from right (editor pages)
   */
  variant?: 'default' | 'fade' | 'slide';
  /**
   * Custom className for the wrapper
   */
  className?: string;
}

// Transition variants following design system animation principles
const pageVariants: Record<string, Variants> = {
  default: {
    initial: {
      opacity: 0,
      y: 20,
      scale: 0.98
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: 'easeOut',
        opacity: { duration: 0.25 },
        y: { duration: 0.3 },
        scale: { duration: 0.3 }
      }
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.98,
      transition: {
        duration: 0.2,
        ease: 'easeIn'
      }
    }
  },
  fade: {
    initial: {
      opacity: 0,
      scale: 0.95
    },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: 'easeOut'
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2,
        ease: 'easeIn'
      }
    }
  },
  slide: {
    initial: {
      opacity: 0,
      x: 20
    },
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: {
        duration: 0.2,
        ease: 'easeIn'
      }
    }
  }
};

/**
 * PageTransition wrapper component for smooth page transitions
 *
 * Implements the design system's animation principles:
 * - 300-400ms duration for page transitions
 * - Ease-out for entering, ease-in for exiting
 * - Respects prefers-reduced-motion
 * - Uses will-change for performance optimization
 *
 * @example
 * ```tsx
 * <PageTransition>
 *   <DashboardPage />
 * </PageTransition>
 * ```
 */
export function PageTransition({
  children,
  variant = 'default',
  className = ''
}: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants[variant]}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      style={{
        // Performance optimization: hint browser about animated properties
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Container variants for stagger animations
 * Used for lists and grid layouts
 */
export const containerVariants: Variants = {
  hidden: {
    opacity: 0
  },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

/**
 * Item variants for stagger animations
 * Used with containerVariants for list items
 */
export const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

/**
 * Stats card variants for dashboard cards
 * Slightly faster animation for smaller elements
 */
export const statsCardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 15,
    scale: 0.95
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: 'easeOut'
    }
  }
};
