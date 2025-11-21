import { Router } from 'express';
import { authMiddleware } from '../../../middleware/auth';
import { getMessages, sendMessage, markAsRead } from '../controllers/messageController';

const router = Router();

// Get messages for a conversation
router.get(
  '/:conversationId',
  authMiddleware(),
  getMessages
);

// Send a message
router.post(
  '/',
  authMiddleware(),
  sendMessage
);

// Mark message as read
router.patch(
  '/:messageId/read',
  authMiddleware(),
  markAsRead
);

export default router;
