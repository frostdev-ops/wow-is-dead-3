// React Query mutation hook for authentication

import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { login } from '../../api/auth';

/**
 * Mutation hook for admin login
 */
export function useLoginMutation(): UseMutationResult<string, Error, string> {
  return useMutation({
    mutationFn: (password: string) => login(password),
  });
}
