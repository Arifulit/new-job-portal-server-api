import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  sender: Types.ObjectId;
  recipient: Types.ObjectId;
  content: string;
  read: boolean;
  conversationId: string;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  conversationId: { type: String, required: true, index: true }
}, { timestamps: true });

// Index for faster querying
messageSchema.index({ conversationId: 1, createdAt: 1 });

export default model<IMessage>('Message', messageSchema);
