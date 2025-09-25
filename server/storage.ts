import { type User, type InsertUser, type Bet, type InsertBet, users, bets } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Bet operations
  getAllBets(): Promise<Bet[]>;
  getBetById(id: string): Promise<Bet | undefined>;
  getBetsByPairId(pairId: string): Promise<Bet[]>;
  createBet(bet: InsertBet): Promise<Bet>;
  updateBetStatus(id: string, status: 'pending' | 'won' | 'lost' | 'returned'): Promise<Bet | undefined>;
  deleteBet(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Bet operations
  async getAllBets(): Promise<Bet[]> {
    return await db.select().from(bets).orderBy(desc(bets.createdAt));
  }

  async getBetById(id: string): Promise<Bet | undefined> {
    const [bet] = await db.select().from(bets).where(eq(bets.id, id));
    return bet || undefined;
  }

  async getBetsByPairId(pairId: string): Promise<Bet[]> {
    return await db.select().from(bets).where(eq(bets.pairId, pairId));
  }

  async createBet(insertBet: InsertBet): Promise<Bet> {
    const [bet] = await db
      .insert(bets)
      .values(insertBet)
      .returning();
    return bet;
  }

  async updateBetStatus(id: string, status: 'pending' | 'won' | 'lost' | 'returned'): Promise<Bet | undefined> {
    const [bet] = await db
      .update(bets)
      .set({ status })
      .where(eq(bets.id, id))
      .returning();
    return bet || undefined;
  }

  async deleteBet(id: string): Promise<boolean> {
    const result = await db.delete(bets).where(eq(bets.id, id));
    return (result as any).rowsAffected > 0;
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private bets: Map<string, Bet>;

  constructor() {
    this.users = new Map();
    this.bets = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Bet operations
  async getAllBets(): Promise<Bet[]> {
    return Array.from(this.bets.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getBetById(id: string): Promise<Bet | undefined> {
    return this.bets.get(id);
  }

  async getBetsByPairId(pairId: string): Promise<Bet[]> {
    return Array.from(this.bets.values()).filter(bet => bet.pairId === pairId);
  }

  async createBet(insertBet: InsertBet): Promise<Bet> {
    const id = randomUUID();
    const bet: Bet = { 
      ...insertBet, 
      id, 
      status: insertBet.status || 'pending',
      gameDate: insertBet.gameDate || new Date(),
      isVerified: insertBet.isVerified || false,
      totalPairStake: insertBet.totalPairStake || null,
      profitPercentage: insertBet.profitPercentage || null,
      createdAt: new Date() 
    };
    this.bets.set(id, bet);
    console.log('Bet created in storage:', bet);
    return bet;
  }

  async updateBetStatus(id: string, status: 'pending' | 'won' | 'lost' | 'returned'): Promise<Bet | undefined> {
    const bet = this.bets.get(id);
    if (bet) {
      const updatedBet: Bet = { ...bet, status };
      this.bets.set(id, updatedBet);
      console.log('Bet status updated:', updatedBet);
      return updatedBet;
    }
    return undefined;
  }

  async deleteBet(id: string): Promise<boolean> {
    const deleted = this.bets.delete(id);
    if (deleted) {
      console.log('Bet deleted:', id);
    }
    return deleted;
  }
}

export const storage = new DatabaseStorage();
