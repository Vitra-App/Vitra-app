import { cache } from 'react';
import { auth } from '@/auth';

/**
 * Cached wrapper around auth() using React cache().
 * Deduplicates the JWT verification so layout + page in the same
 * request share one call instead of running it twice.
 */
export const getSession = cache(auth);
