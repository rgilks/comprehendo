'use client';

import React from 'react';

const QuizSkeleton = () => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
    <div className="h-4 bg-gray-700 rounded w-3/4 mb-4 animate-pulse"></div>

    <div className="space-y-3 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-3 bg-gray-700 rounded animate-pulse ${
            i === 3 ? 'w-5/6' : i === 4 ? 'w-4/6' : 'w-full'
          }`}
        ></div>
      ))}
    </div>

    <div className="h-4 bg-gray-700 rounded w-1/2 mb-4 animate-pulse"></div>

    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 bg-gray-700 rounded w-full animate-pulse"></div>
      ))}
    </div>
  </div>
);

export default QuizSkeleton;
