import { type User, type InsertUser, type Bet, type InsertBet } from "@shared/schema";
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

export const storage = new MemStorage();
