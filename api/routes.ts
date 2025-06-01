import { Hono } from 'hono';
import usersRoute from './routes/users';
import postsRoute from './routes/posts';
import likesRoute from './routes/likes';
import commentsRoute from './routes/comments';
import followersRoute from './routes/followers';
import hashtagsRoute from './routes/hashtags';

// Create a new router
const routes = new Hono()
  .route('/users', usersRoute)
  .route('/posts', postsRoute)
  .route('/likes', likesRoute)
  .route('/comments', commentsRoute)
  .route('/followers', followersRoute)
  .route('/hashtags', hashtagsRoute)
  .get('/healthz', c => c.text('Health OK'));

export default routes;
