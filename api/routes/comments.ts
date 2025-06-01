import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import prisma from '../lib/db';
import { handleNotFound } from '../lib/utils';
import {
  createCommentsSchema,
  updateCommentsSchema,
  commentsIdParamSchema,
  commentsQuerySchema,
  commentsSearchQuerySchema,
  processCommentsQueryParams,
} from '../validations/comments';

const app = new Hono()
  // GET /comments - Get all comments
  .get('/', zValidator('query', commentsQuerySchema), async c => {
    try {
      const validatedQuery = c.req.valid('query');
      const options = processCommentsQueryParams(validatedQuery);
      const whereClause = { ...options.where }; // Start with existing where conditions

      // Get total count and items based on processed options (where, skip, take)
      const [items, total] = await Promise.all([
        prisma.comments.findMany({
          where: whereClause,
          skip: options.skip,
          take: options.take,
          orderBy: { id: 'desc' },
        }),
        prisma.comments.count({ where: whereClause }),
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
      console.error('Failed to retrieve comments:', error); // Log error
      c.status(500);
      return c.json({
        error: 'Failed to retrieve comments',
        details:
          error instanceof Error ? error.message : 'Unknown internal error',
      });
    }
  })
  // GET /comments/:id - Get Comments by ID
  .get('/:id', zValidator('param', commentsIdParamSchema), async c => {
    try {
      // Get validated ID from URL parameters
      const { id: validatedIdString } = c.req.valid('param');
      const id = validatedIdString;
      const whereClause: { id: string } = { id };

      const item = await prisma.comments.findUnique({
        where: whereClause,
        // https://www.prisma.io/docs/orm/reference/prisma-client-reference#include
        // include: { name_of_relation: true }
      });

      // Handle not found
      if (!item) {
        c.status(404);
        return c.json({ error: 'comments not found' });
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
  // POST /comments - Create a new Comments
  .post('/', zValidator('json', createCommentsSchema), async c => {
    try {
      // Get validated data from the request body middleware (with cast)
      const validatedData = c.req.valid('json');

      // Create comments using the validated data
      const item = await prisma.comments.create({
        data: validatedData,
        // https://www.prisma.io/docs/orm/reference/prisma-client-reference#include
        // include: { name_of_relation: true }
      });

      c.status(201);

      return c.json(item);
    } catch (error: unknown) {
      console.error('Failed to create comments:', error);
      // Handle potential Prisma unique constraint errors, etc.
      // @ts-expect-error: error is unknown
      if (error?.code === 'P2002') {
        // Example: Unique constraint failed
        c.status(409); // Conflict
        return c.json({
          error: 'Could not create comments',
          // @ts-expect-error: error is unknown
          details: error.meta?.target,
        });
      }
      c.status(500);
      return c.json({
        error: 'Failed to create comments',
        details:
          error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  })
  // PUT /comments/:id - Update Comments by ID
  .put(
    '/:id',
    zValidator('param', commentsIdParamSchema),
    zValidator('json', updateCommentsSchema),
    async c => {
      try {
        // Get validated ID and JSON body data (with cast)
        const { id: validatedIdString } = c.req.valid('param');
        const validatedData = c.req.valid('json');
        const id = validatedIdString;

        const whereClause: { id: string } = { id };

        const item = await prisma.comments.update({
          where: whereClause,
          data: validatedData,
          // https://www.prisma.io/docs/orm/reference/prisma-client-reference#include
          // include: { name_of_relation: true }
        });

        return c.json(item);
      } catch (error: unknown) {
        console.error(`Failed to update comments ${c.req.param('id')}:`, error);
        // Use the service function to handle common errors like 'not found' (P2025)
        // Also catches potential unique constraint errors on update (P2002)
        return handleNotFound(error, c);
      }
    },
  )
  // DELETE /comments/:id - Delete Comments by ID
  .delete('/:id', zValidator('param', commentsIdParamSchema), async c => {
    try {
      // Get validated ID (with cast)
      const { id: validatedIdString } = c.req.valid('param');
      const id = validatedIdString;

      const whereClause: { id: string } = { id };

      await prisma.comments.delete({
        where: whereClause,
      });

      // Return standard success response
      return c.json({
        success: true,
        message: 'comments deleted successfully',
      });
    } catch (error: unknown) {
      console.error(`Failed to delete comments ${c.req.param('id')}:`, error);
      // Use the service function to handle 'not found' (P2025)
      return handleNotFound(error, c);
    }
  })
  // GET /comments/search - Search comments by name
  .get('/search', zValidator('query', commentsSearchQuerySchema), async c => {
    try {
      // Get validated query parameters from middleware
      const validatedQuery = c.req.valid('query');

      // Pagination logic (similar to processcommentsQueryParams but simpler for just page/limit)
      const page = validatedQuery.page ? parseInt(validatedQuery.page, 10) : 1;
      const limit = validatedQuery.limit
        ? parseInt(validatedQuery.limit, 10)
        : 10;
      const take = Math.min(Math.max(limit, 1), 100); // Clamp limit between 1 and 100
      const skip = (page - 1) * take;

      // Prepare the where clause for Prisma
      const whereClause = {
        OR: [
          {
            content: {
              startsWith: validatedQuery.query,
              mode: 'insensitive' as const,
            },
          },
        ],
      };

      // Execute the search query and count query concurrently
      const [items, total] = await Promise.all([
        prisma.comments.findMany({
          where: whereClause,
          skip: skip,
          take: take,
          orderBy: { id: 'desc' },
        }),
        prisma.comments.count({ where: whereClause }),
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
      console.error('Failed to search comments:', error);
      c.status(500);
      return c.json({
        error: 'Failed to search comments',
        details:
          error instanceof Error ? error.message : 'Unknown internal error',
      });
    }
  });

export default app;
