import { Request, Response } from 'express';
import Message from '../models/Message';
import { Types } from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'recruiter' | 'candidate' | 'admin';
    email?: string;
    [key: string]: any; // Allow additional properties
  };
}

export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }

    const query: any = {
      conversationId,
      $or: [
        { sender: userId },
        { recipient: userId }
      ]
    };

    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('sender', 'name email avatar')
      .populate('recipient', 'name email avatar')
      .lean();

    return res.status(200).json({
      success: true,
      data: messages.reverse() // Return in chronological order
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recipient, content, conversationId } = req.body;
    const sender = req.user?.id;

    if (!recipient || !content || !conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient, content, and conversation ID are required'
      });
    }

    const message = new Message({
      sender,
      recipient,
      content,
      conversationId
    });

    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email avatar')
      .populate('recipient', 'name email avatar');

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: populatedMessage
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;

    const message = await Message.findOneAndUpdate(
      { _id: messageId, recipient: userId },
      { $set: { read: true } },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Message marked as read',
      data: message
    });

  } catch (error) {
    console.error('Error marking message as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark message as read'
    });
  }
};
