import { Schema, model, Types } from "mongoose";

export interface IAdminProfile {
  user?: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: "Admin";
  comparePassword?: (candidatePassword: string) => Promise<boolean>;
  createdAt?: Date;
  updatedAt?: Date;
}

const adminProfileSchema = new Schema<IAdminProfile>({
  user: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: false, 
    unique: true, 
    sparse: true 
  },
  name: { 
    type: String, 
    required: [true, 'Name is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  password: {
    type: String,
    required: false, // Made password optional
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  role: { 
    type: String, 
    default: "Admin",
    enum: ["Admin"],
    immutable: true
  }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret: Record<string, any>) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// Method to compare passwords
adminProfileSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    const bcrypt = await import('bcryptjs');
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
};

// Pre-save hook to hash password
adminProfileSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    if (this.password) {
      const salt = await (await import('bcryptjs')).genSalt(10);
      this.password = await (await import('bcryptjs')).hash(this.password, salt);
    }
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to set or update password
adminProfileSchema.methods.setPassword = async function(password: string) {
  this.password = password;
  await this.save();
  return this;
};

export const AdminProfile = model<IAdminProfile>("AdminProfile", adminProfileSchema);
