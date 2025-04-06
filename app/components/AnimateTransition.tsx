'use client';

import { ReactNode, useState, useEffect } from 'react';

type AnimationType =
  | 'fade-in'
  | 'slide-down'
  | 'slide-up'
  | 'slide-left'
  | 'slide-right'
  | 'scale-up'
  | 'scale-down';

interface AnimateTransitionProps {
  children: ReactNode;
  show: boolean;
  type?: AnimationType;
  duration?: number;
  delay?: number;
  className?: string;
  unmountOnExit?: boolean;
}

const AnimateTransition = ({
  children,
  show,
  type = 'fade-in',
  duration = 300,
  delay = 0,
  className = '',
  unmountOnExit = false,
}: AnimateTransitionProps) => {
  const [shouldRender, setShouldRender] = useState(show);
  const [isAnimating, setIsAnimating] = useState(false);

  // Track if we're in exit animation
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (show) {
      setIsExiting(false);
      setShouldRender(true);
      // Short delay to ensure DOM update before animation starts
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      // Start exit animation
      setIsExiting(true);
      setIsAnimating(false);

      if (unmountOnExit) {
        // Wait for exit animation to complete before unmounting
        timer = setTimeout(() => {
          setIsExiting(false);
          setShouldRender(false);
        }, duration);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [show, duration, unmountOnExit]);

  // Don't render anything if we shouldn't render
  if (!shouldRender && unmountOnExit) {
    return null;
  }

  // Base transition for all animation types
  const baseTransition = `transition-all duration-${duration} ease-out`;

  // Get the appropriate classes based on animation state and type
  const getAnimationClasses = () => {
    const exitMap: Record<AnimationType, string> = {
      'fade-in': 'opacity-0',
      'slide-down': 'opacity-0 -translate-y-10',
      'slide-up': 'opacity-0 translate-y-10',
      'slide-left': 'opacity-0 translate-x-20',
      'slide-right': 'opacity-0 -translate-x-20',
      'scale-up': 'opacity-0 scale-95',
      'scale-down': 'opacity-0 scale-105',
    };

    if (isAnimating) {
      return `animate-${type}`;
    } else if (isExiting) {
      return exitMap[type];
    } else {
      return 'opacity-0';
    }
  };

  // Apply delay if needed
  const delayStyle = delay && !isExiting ? { animationDelay: `${delay}ms` } : {};

  return (
    <div
      className={`${baseTransition} ${getAnimationClasses()} ${className}`}
      style={{
        ...delayStyle,
        animationFillMode: 'forwards',
        visibility: isAnimating || isExiting || !unmountOnExit ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>
  );
};

export default AnimateTransition;
