import { z } from 'zod';

// Schema for URL parameters (expecting string from URL)
export const followersIdParamSchema = z.object({
  id: z.string(),
});

// Schema for query parameters (expecting strings from URL)
export const followersQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .refine(val => val === undefined || /^\d+$/.test(val), {
      message: 'Page must be a positive integer string',
    }),
  limit: z
    .string()
    .optional()
    .refine(val => val === undefined || /^\d+$/.test(val), {
      message: 'Limit must be a positive integer string',
    }),
  name: z.string().optional(),
  description: z.string().optional(),
});

// Schema for followers search query parameters
export const followersSearchQuerySchema = z.object({
  query: z
    .string({
      required_error: 'Search query is required',
      invalid_type_error: 'Search query must be a string',
    })
    .min(1, { message: 'Search query cannot be empty' }),
  page: z
    .string()
    .optional()
    .refine(val => val === undefined || /^\d+$/.test(val), {
      message: 'Page must be a positive integer string',
    }),
  limit: z
    .string()
    .optional()
    .refine(val => val === undefined || /^\d+$/.test(val), {
      message: 'Limit must be a positive integer string',
    }),
});

export const createFollowersSchema = z.object({
  followerId: z.coerce.bigint(),
  followeeId: z.coerce.bigint(),
});

export const updateFollowersSchema = z.object({
  followerId: z.coerce.bigint(),
  followeeId: z.coerce.bigint(),
});

const internalQueryParamsSchema = z.object({
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

interface ProcessedFollowersQueryParams {
  where: Record<string, any>; // Using Record<string, any> for the dynamic where clause
  skip: number;
  take: number;
}

export const processFollowersQueryParams = (
  query: z.infer<typeof followersQuerySchema>,
): ProcessedFollowersQueryParams => {
  const page = query.page ? parseInt(query.page, 10) : undefined;
  const limit = query.limit ? parseInt(query.limit, 10) : undefined;
  const take = limit && limit > 0 && limit <= 100 ? limit : 10; // Guaranteed number
  const skip = page && page > 0 ? (page - 1) * take : 0; // Guaranteed number

  // Optional: Validate other params if needed, but we already have skip/take
  const parseResult = internalQueryParamsSchema.safeParse({
    skip,
    take,
    page,
    limit,
    name: query.name,
    description: query.description,
  });

  if (!parseResult.success) {
    // Log error but return defaults for pagination, potentially empty where clause
    console.error(
      'followers query parameter processing error:',
      parseResult.error,
    );
    return { where: {}, skip: 0, take: 10 };
  }

  // Use validated name/description for the where clause
  const { name, description } = parseResult.data;
  const where: Record<string, any> = {}; // Match interface type
  if (name) {
    where.name = { contains: name, mode: 'insensitive' };
  }
  if (description) {
    where.description = { contains: description, mode: 'insensitive' };
  }

  // Return the determined where clause and the guaranteed numeric skip/take values
  return { where, skip, take };
};
