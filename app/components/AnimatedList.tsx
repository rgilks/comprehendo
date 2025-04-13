'use client';

import React, { ReactNode } from 'react';
// import AnimateTransition from './AnimateTransition'; // Remove import

interface AnimatedListProps {
  items: ReactNode[];
  visible: boolean;
  // animationType?: 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'scale-up'; // No longer used
  // staggerDelay?: number; // No longer used
  className?: string;
  itemClassName?: string;
}

const AnimatedList = ({
  items,
  visible,
  // animationType = 'slide-up', // No longer used
  // staggerDelay = 100, // No longer used
  className = '',
  itemClassName = '',
}: AnimatedListProps) => {
  return (
    <div className={className}>
      {items.map((item, index) => (
        // Replaced AnimateTransition
        <div key={index} className={`${itemClassName} ${!visible ? 'hidden' : ''}`}>
          {item}
        </div>
      ))}
    </div>
  );
};

export default AnimatedList;
