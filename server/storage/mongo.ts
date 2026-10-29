import { MongoClient, ObjectId, type Collection } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Conversation } from './store';

export interface UserDocument {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  avatarColor: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationDocument {
  _id: string; // Conversation ID string (e.g. conv_123456789)
  userId: string;
  title: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  model: string;
  provider: string;
  messages: any[];
  currentTask?: any;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  createdAt: number;
}

const avatarColors = [
  'linear-gradient(135deg, #ff6644 0%, #ff8554 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
];

export class MongoUserStore {
  private client: MongoClient;
  private users?: Collection<UserDocument>;
  private conversations?: Collection<ConversationDocument>;

  constructor(private readonly uri: string, private readonly databaseName: string, private readonly jwtSecret: string) {
    this.client = new MongoClient(uri);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    const db = this.client.db(this.databaseName);
    this.users = db.collection<UserDocument>('users');
    this.conversations = db.collection<ConversationDocument>('conversations');

    await this.users.createIndex({ email: 1 }, { unique: true });
    await this.conversations.createIndex({ userId: 1 });
    await this.conversations.createIndex({ userId: 1, updatedAt: -1 });
  }

  isConnected(): boolean {
    return !!this.users;
  }

  private collection(): Collection<UserDocument> {
    if (!this.users) throw new Error('Database connection is unavailable. Check MONGODB_URI and restart the server.');
    return this.users;
  }

  private toAuthUser(user: UserDocument): AuthUser {
    return {
      id: user._id.toHexString(),
      name: user.name,
      email: user.email,
      role: user.role,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt.getTime(),
    };
  }

  private createToken(user: UserDocument): string {
    return jwt.sign({ sub: user._id.toHexString(), email: user.email }, this.jwtSecret, { expiresIn: '7d' });
  }

  async register(name: string, email: string, password: string, role = 'AI Engineer'): Promise<{ user: AuthUser; token: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();
    const user: UserDocument = {
      _id: new ObjectId(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: role.trim() || 'AI Engineer',
      avatarColor: avatarColors[Math.floor(Math.random() * avatarColors.length)],
      createdAt: now,
      updatedAt: now,
    };
    try {
      await this.collection().insertOne(user);
    } catch (error: any) {
      if (error?.code === 11000) throw new Error('An account with this email address already exists.');
      throw error;
    }
    return { user: this.toAuthUser(user), token: this.createToken(user) };
  }

  async authenticate(email: string, password: string): Promise<{ user: AuthUser; token: string } | null> {
    const user = await this.collection().findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
    return { user: this.toAuthUser(user), token: this.createToken(user) };
  }

  async getUserFromToken(token: string): Promise<AuthUser | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
      if (!payload.sub || typeof payload.sub !== 'string' || !ObjectId.isValid(payload.sub)) return null;
      const user = await this.collection().findOne({ _id: new ObjectId(payload.sub) });
      return user ? this.toAuthUser(user) : null;
    } catch {
      return null;
    }
  }

  // --- Multi-Tenant User Conversations Isolation in MongoDB Atlas ---

  async getUserConversations(userId: string): Promise<Conversation[]> {
    if (!this.conversations) return [];
    const docs = await this.conversations.find({ userId }).sort({ updatedAt: -1 }).toArray();
    return docs.map((d) => ({
      id: d._id,
      userId: d.userId,
      title: d.title,
      pinned: !!d.pinned,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      model: d.model,
      provider: d.provider,
      messages: d.messages || [],
      currentTask: d.currentTask,
    }));
  }

  async getConversation(id: string, userId: string): Promise<Conversation | null> {
    if (!this.conversations) return null;
    const doc = await this.conversations.findOne({ _id: id as any, userId });
    if (!doc) return null;
    return {
      id: doc._id,
      userId: doc.userId,
      title: doc.title,
      pinned: !!doc.pinned,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      model: doc.model,
      provider: doc.provider,
      messages: doc.messages || [],
      currentTask: doc.currentTask,
    };
  }

  async saveConversation(conv: Conversation, userId: string): Promise<void> {
    if (!this.conversations) return;
    const filter = { _id: conv.id as any, userId };
    const update = {
      $set: {
        userId,
        title: conv.title,
        pinned: !!conv.pinned,
        createdAt: conv.createdAt || Date.now(),
        updatedAt: Date.now(),
        model: conv.model,
        provider: conv.provider,
        messages: conv.messages || [],
        currentTask: conv.currentTask,
      },
    };
    await this.conversations.updateOne(filter, update, { upsert: true });
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    if (!this.conversations) return false;
    const res = await this.conversations.deleteOne({ _id: id as any, userId });
    return (res.deletedCount || 0) > 0;
  }
}
