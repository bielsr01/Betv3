import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const accountHolders = pgTable("account_holders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cpf: text("cpf"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const bettingHouses = pgTable("betting_houses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  password: text("password"),
  accountHolderId: varchar("account_holder_id").references(() => accountHolders.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const bets = pgTable("bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamA: text("team_a").notNull(), // First team
  teamB: text("team_b").notNull(), // Second team
  betType: text("bet_type").notNull(),
  selectedSide: text("selected_side").notNull(), // The side/outcome being bet on (e.g., "Team A", "Over 2.5", etc.)
  bettingHouse: text("betting_house").notNull(), // Betting house name (temporary - matches current DB)
  odds: decimal("odds", { precision: 10, scale: 2 }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }).notNull(),
  payout: decimal("payout", { precision: 10, scale: 2 }).notNull(),
  gameDate: text("game_date").notNull(), // DD-MM-YYYY format
  gameTime: text("game_time").notNull(), // HH:MM format
  sport: text("sport").notNull(),
  league: text("league").notNull(),
  status: text("status", { enum: ["pending", "won", "lost", "returned"] }).notNull().default("pending"),
  isVerified: boolean("is_verified").notNull().default(false),
  pairId: varchar("pair_id").notNull(), // Always paired - links two opposing bets
  betPosition: text("bet_position", { enum: ["A", "B"] }).notNull(), // Position in the pair
  totalPairStake: decimal("total_pair_stake", { precision: 10, scale: 2 }), // Total invested in both bets
  profitPercentage: decimal("profit_percentage", { precision: 5, scale: 2 }), // Profit % when this bet wins
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAccountHolderSchema = createInsertSchema(accountHolders).omit({
  id: true,
  createdAt: true,
});

export const insertBettingHouseSchema = createInsertSchema(bettingHouses).omit({
  id: true,
  createdAt: true,
});

export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAccountHolder = z.infer<typeof insertAccountHolderSchema>;
export type AccountHolder = typeof accountHolders.$inferSelect;
export type InsertBettingHouse = z.infer<typeof insertBettingHouseSchema>;
export type BettingHouse = typeof bettingHouses.$inferSelect;
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof bets.$inferSelect;

// OCR extracted data for a single bet
export const singleBetOCRSchema = z.object({
  bettingHouse: z.string().min(1, "Casa de aposta é obrigatória"),
  teamA: z.string().min(1, "Time A é obrigatório"),
  teamB: z.string().min(1, "Time B é obrigatório"),
  betType: z.string().min(1, "Tipo de aposta é obrigatório"),
  odds: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Odd deve ser um número válido"),
  stake: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Valor da aposta deve ser um número válido"),
  profit: z.string().refine((val) => !isNaN(Number(val)), "Lucro deve ser um número válido"),
});

// OCR extracted data for paired bets (two opposing bets)
export const ocrDataSchema = z.object({
  betA: singleBetOCRSchema,
  betB: singleBetOCRSchema,
  gameDate: z.union([z.string(), z.date()]), // Can be string (DD-MM-YYYY) or Date object
  gameTime: z.string().optional(), // HH:MM format
  gameDateFormatted: z.string().optional(), // DD-MM-YYYY format for display
  gameDateTime: z.string().optional(), // Combined DD-MM-YYYY HH:MM format
  sport: z.string().min(1, "Esporte é obrigatório"),
  league: z.string().min(1, "Liga é obrigatória"),
  totalProfitPercentage: z.string().refine((val) => !isNaN(parseFloat(val.replace('%', ''))), "Porcentagem de lucro total deve ser um número válido"),
}).refine(
  (data) => {
    // Ensure teams are consistent across both bets (normalized comparison)
    const normalize = (team: string) => team.trim().toLowerCase();
    return normalize(data.betA.teamA) === normalize(data.betB.teamA) && 
           normalize(data.betA.teamB) === normalize(data.betB.teamB);
  },
  {
    message: "Times devem ser consistentes entre as duas apostas",
    path: ["betB", "teamA"],
  }
);

export type SingleBetOCR = z.infer<typeof singleBetOCRSchema>;
export type OCRData = z.infer<typeof ocrDataSchema>;

// Helper functions for bet pair calculations
export const calculatePairMetrics = (stakeA: number, stakeB: number, payoutA: number, payoutB: number) => {
  const totalStake = stakeA + stakeB;
  const profitPercentageA = totalStake > 0 ? ((payoutA - totalStake) / totalStake) * 100 : 0;
  const profitPercentageB = totalStake > 0 ? ((payoutB - totalStake) / totalStake) * 100 : 0;
  
  return {
    totalStake,
    profitPercentageA,
    profitPercentageB,
  };
};

// Helper type for bet pair creation
export type BetPairData = {
  pairId: string;
  gameDate: Date;
  totalStake: number;
  profitPercentageA: number; // Profit % if bet A wins
  profitPercentageB: number; // Profit % if bet B wins
};

// Validation helpers
export const validateBetPair = (betA: Partial<Bet>, betB: Partial<Bet>) => {
  const errors: string[] = [];
  
  if (betA.pairId !== betB.pairId) {
    errors.push("Apostas devem ter o mesmo pairId");
  }
  
  if (betA.teamA !== betB.teamA || betA.teamB !== betB.teamB) {
    errors.push("Times devem ser iguais em ambas as apostas");
  }
  
  if (betA.betPosition === betB.betPosition) {
    errors.push("Apostas devem ser em lados opostos");
  }
  
  if (betA.betPosition === betB.betPosition) {
    errors.push("Posições das apostas devem ser diferentes (A e B)");
  }
  
  return errors;
};
