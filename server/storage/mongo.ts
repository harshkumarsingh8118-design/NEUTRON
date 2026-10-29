import { MongoClient, ObjectId, type Collection } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

  constructor(private readonly uri: string, private readonly databaseName: string, private readonly jwtSecret: string) {
    this.client = new MongoClient(uri);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.users = this.client.db(this.databaseName).collection<UserDocument>('users');
    await this.users.createIndex({ email: 1 }, { unique: true });
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
}
