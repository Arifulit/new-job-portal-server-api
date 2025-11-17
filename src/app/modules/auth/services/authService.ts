// import { User, IUser } from "../models/User";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";

// const JWT_SECRET = process.env.JWT_SECRET || "secretkey";

// export const registerUser = async (name: string, email: string, password: string, role: IUser["role"]) => {
//   const existing = await User.findOne({ email });
//   if (existing) throw new Error("Email already exists");

//   const hashed = await bcrypt.hash(password, 10);
//   const user = await User.create({ name, email, password: hashed, role });
//   return user;
// };

// export const loginUser = async (email: string, password: string) => {
//   const user = await User.findOne({ email });
//   if (!user) throw new Error("User not found");

//   const match = await bcrypt.compare(password, user.password);
//   if (!match) throw new Error("Password incorrect");

//   const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
//   return { user, token };
// };

import { User, IUser } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secretkey";

export const registerUser = async (name: string, email: string, password: string, role: IUser["role"]) => {
  const existing = await User.findOne({ email });
  if (existing) throw new Error("Email already exists");

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, role });
  return user;
};

export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Password incorrect");

  return { user };
};

export const signToken = (payload: any, expiresIn: string | number = "1d") => {
  return jwt.sign(payload, JWT_SECRET as jwt.Secret, { expiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET as jwt.Secret);
};
