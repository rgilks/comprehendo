'use client';

import React, { ReactNode } from 'react';

interface AnimatedListProps {
  items: ReactNode[];
  visible: boolean;
  className?: string;
  itemClassName?: string;
}

const AnimatedList = ({
  items,
  visible,
  className = '',
  itemClassName = '',
}: AnimatedListProps) => {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={index} className={`${itemClassName} ${!visible ? 'hidden' : ''}`}>
          {item}
        </div>
      ))}
    </div>
  );
};

export default AnimatedList;
