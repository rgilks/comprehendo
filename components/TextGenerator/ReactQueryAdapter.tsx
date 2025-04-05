'use client';

import { useEffect } from 'react';
import { useChatMutation, ChatRequestParams } from '@/lib/api';

// Define a type for the global window with our React Query mutation
interface WindowWithReactQuery extends Window {
  __reactQueryChatMutation?: {
    mutateAsync: (params: ChatRequestParams) => Promise<string>;
  };
}

/**
 * This component adapts React Query's capabilities to the TextGeneratorStore
 * It doesn't render anything but provides the mutation capabilities to the store
 */
export default function ReactQueryAdapter() {
  const chatMutation = useChatMutation();

  // This effect runs only once when the component mounts
  useEffect(() => {
    // Create a patched version of the internal chat mutation that uses React Query
    const patchedChatMutation = {
      mutateAsync: async (params: ChatRequestParams) => {
        try {
          return await chatMutation.mutateAsync(params);
        } catch (error) {
          // Let the original error handling in the store deal with this
          throw error;
        }
      },
    };

    // Store reference to this patched mutation in a variable accessible by the store
    (window as WindowWithReactQuery).__reactQueryChatMutation = patchedChatMutation;

    // Cleanup function
    return () => {
      // Remove the reference when component unmounts
      delete (window as WindowWithReactQuery).__reactQueryChatMutation;
    };
  }, [chatMutation]);

  // This component doesn't render anything
  return null;
}
