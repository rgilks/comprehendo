'use client';

import React from 'react';
import AnimateTransition from '@/components/AnimateTransition';

const QuizSkeleton = () => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
    <AnimateTransition
      show={true}
      type="fade-in"
      duration={400}
      className="h-4 bg-gray-700 rounded w-3/4 mb-4 animate-pulse"
    >
      <div></div>
    </AnimateTransition>

    <div className="space-y-3 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <AnimateTransition
          key={i}
          show={true}
          type="slide-right"
          duration={400}
          delay={i * 100}
          className={`h-3 bg-gray-700 rounded animate-pulse ${
            i === 3 ? 'w-5/6' : i === 4 ? 'w-4/6' : 'w-full'
          }`}
        >
          <div></div>
        </AnimateTransition>
      ))}
    </div>

    <AnimateTransition
      show={true}
      type="fade-in"
      duration={400}
      delay={600}
      className="h-4 bg-gray-700 rounded w-1/2 mb-4 animate-pulse"
    >
      <div></div>
    </AnimateTransition>

    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <AnimateTransition
          key={i}
          show={true}
          type="slide-left"
          duration={500}
          delay={600 + i * 150}
          className="h-10 bg-gray-700 rounded w-full animate-pulse"
        >
          <div></div>
        </AnimateTransition>
      ))}
    </div>
  </div>
);

export default QuizSkeleton;
