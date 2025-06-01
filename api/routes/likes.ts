import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import prisma from '../lib/db';
import { handleNotFound } from '../lib/utils';
import {
  createLikesSchema,
  updateLikesSchema,
  likesIdParamSchema,
  likesQuerySchema,
  likesSearchQuerySchema,
  processLikesQueryParams,
} from '../validations/likes';

const app = new Hono()
  // GET /likes - Get all likes
  .get('/', zValidator('query', likesQuerySchema), async c => {
    try {
      const validatedQuery = c.req.valid('query');
      const options = processLikesQueryParams(validatedQuery);
      const whereClause = { ...options.where }; // Start with existing where conditions

      // Get total count and items based on processed options (where, skip, take)
      const [items, total] = await Promise.all([
        prisma.likes.findMany({
          where: whereClause,
          skip: options.skip,
          take: options.take,
          orderBy: { id: 'desc' },
        }),
        prisma.likes.count({ where: whereClause }),
      ]);

      return c.json({
        data: items,
        meta: {
          total,
          skip: options.skip,
          take: options.take,
          page: Math.floor(options.skip / options.take) + 1,
          totalPages: Math.ceil(total / options.take),
        },
      });
    } catch (error) {
      console.error('Failed to retrieve likes:', error); // Log error
      c.status(500);
      return c.json({
        error: 'Failed to retrieve likes',
        details:
          error instanceof Error ? error.message : 'Unknown internal error',
      });
    }
  })
  // GET /likes/:id - Get Likes by ID
  .get('/:id', zValidator('param', likesIdParamSchema), async c => {
    try {
      // Get validated ID from URL parameters
      const { id: validatedIdString } = c.req.valid('param');
      const id = validatedIdString;
      const whereClause: { id: string } = { id };

      const item = await prisma.likes.findUnique({
        where: whereClause,
        // https://www.prisma.io/docs/orm/reference/prisma-client-reference#include
        // include: { name_of_relation: true }
      });

      // Handle not found
      if (!item) {
        c.status(404);
        return c.json({ error: 'likes not found' });
      }

      return c.json(item);
    } catch (error: unknown) {
      console.error(`Failed to retrieve item ${c.req.param('id')}:`, error);

      return c.json({
        error: 'Failed to retrieve item',
        details:
          error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  })
  // POST /likes - Create a new Likes
  .post('/', zValidator('json', createLikesSchema), async c => {
    try {
      // Get validated data from the request body middleware (with cast)
      const validatedData = c.req.valid('json');

      // Create likes using the validated data
      const item = await prisma.likes.create({
        data: validatedData,
        // https://www.prisma.io/docs/orm/reference/prisma-client-reference#include
        // include: { name_of_relation: true }
      });

      c.status(201);

      return c.json(item);
    } catch (error: unknown) {
      console.error('Failed to create likes:', error);
      // Handle potential Prisma unique constraint errors, etc.
      // @ts-expect-error: error is unknown
      if (error?.code === 'P2002') {
        // Example: Unique constraint failed
        c.status(409); // Conflict
        return c.json({
          error: 'Could not create likes',
          // @ts-expect-error: error is unknown
          details: error.meta?.target,
        });
      }
      c.status(500);
      return c.json({
        error: 'Failed to create likes',
        details:
          error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  })
  // PUT /likes/:id - Update Likes by ID
  .put(
    '/:id',
    zValidator('param', likesIdParamSchema),
    zValidator('json', updateLikesSchema),
    async c => {
      try {
        // Get validated ID and JSON body data (with cast)
        const { id: validatedIdString } = c.req.valid('param');
        const validatedData = c.req.valid('json');
        const id = validatedIdString;

        const whereClause: { id: string } = { id };

        const item = await prisma.likes.update({
          where: whereClause,
          data: validatedData,
          // https://www.prisma.io/docs/orm/reference/prisma-client-reference#include
          // include: { name_of_relation: true }
        });

        return c.json(item);
      } catch (error: unknown) {
        console.error(`Failed to update likes ${c.req.param('id')}:`, error);
        // Use the service function to handle common errors like 'not found' (P2025)
        // Also catches potential unique constraint errors on update (P2002)
        return handleNotFound(error, c);
      }
    },
  )
  // DELETE /likes/:id - Delete Likes by ID
  .delete('/:id', zValidator('param', likesIdParamSchema), async c => {
    try {
      // Get validated ID (with cast)
      const { id: validatedIdString } = c.req.valid('param');
      const id = validatedIdString;

      const whereClause: { id: string } = { id };

      await prisma.likes.delete({
        where: whereClause,
      });

      // Return standard success response
      return c.json({
        success: true,
        message: 'likes deleted successfully',
      });
    } catch (error: unknown) {
      console.error(`Failed to delete likes ${c.req.param('id')}:`, error);
      // Use the service function to handle 'not found' (P2025)
      return handleNotFound(error, c);
    }
  })
  // GET /likes/search - Search likes by name
  .get('/search', zValidator('query', likesSearchQuerySchema), async c => {
    try {
      // Get validated query parameters from middleware
      const validatedQuery = c.req.valid('query');

      // Pagination logic (similar to processlikesQueryParams but simpler for just page/limit)
      const page = validatedQuery.page ? parseInt(validatedQuery.page, 10) : 1;
      const limit = validatedQuery.limit
        ? parseInt(validatedQuery.limit, 10)
        : 10;
      const take = Math.min(Math.max(limit, 1), 100); // Clamp limit between 1 and 100
      const skip = (page - 1) * take;

      // Prepare the where clause for Prisma
      const whereClause = {
        /* searchOr: No string columns found for search. No OR filter applied. */
      };

      // Execute the search query and count query concurrently
      const [items, total] = await Promise.all([
        prisma.likes.findMany({
          where: whereClause,
          skip: skip,
          take: take,
          orderBy: { id: 'desc' },
        }),
        prisma.likes.count({ where: whereClause }),
      ]);

      // Return the paginated results
      return c.json({
        data: items,
        meta: {
          total,
          skip,
          take,
          page: page,
          totalPages: Math.ceil(total / take),
        },
      });
    } catch (error) {
      console.error('Failed to search likes:', error);
      c.status(500);
      return c.json({
        error: 'Failed to search likes',
        details:
          error instanceof Error ? error.message : 'Unknown internal error',
      });
    }
  });

export default app;
