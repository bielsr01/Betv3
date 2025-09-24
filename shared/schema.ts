import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const bets = pgTable("bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bettingHouse: text("betting_house").notNull(),
  teamA: text("team_a").notNull(), // First team
  teamB: text("team_b").notNull(), // Second team
  betType: text("bet_type").notNull(),
  selectedSide: text("selected_side", { enum: ["A", "B"] }).notNull(), // Which side was bet on (A = teamA, B = teamB)
  odds: decimal("odds", { precision: 10, scale: 2 }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }).notNull(),
  potentialProfit: decimal("potential_profit", { precision: 10, scale: 2 }).notNull(),
  gameDate: timestamp("game_date").notNull().default(sql`now()`),
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

export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof bets.$inferSelect;

// OCR extracted data for a single bet
export const singleBetOCRSchema = z.object({
  bettingHouse: z.string().min(1, "Casa de aposta é obrigatória"),
  teamA: z.string().min(1, "Time A é obrigatório"),
  teamB: z.string().min(1, "Time B é obrigatório"),
  betType: z.string().min(1, "Tipo de aposta é obrigatório"),
  selectedSide: z.enum(["A", "B"], { errorMap: () => ({ message: "Lado selecionado deve ser A ou B" }) }),
  odds: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Odd deve ser um número válido"),
  stake: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Valor da aposta deve ser um número válido"),
  potentialProfit: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Lucro potencial deve ser um número válido"),
});

// OCR extracted data for paired bets (two opposing bets)
export const ocrDataSchema = z.object({
  betA: singleBetOCRSchema,
  betB: singleBetOCRSchema,
  gameDate: z.date(),
  gameTime: z.string().optional(),
}).refine(
  (data) => {
    // Ensure teams are consistent across both bets
    return data.betA.teamA === data.betB.teamA && data.betA.teamB === data.betB.teamB;
  },
  {
    message: "Times devem ser consistentes entre as duas apostas",
    path: ["betB", "teamA"],
  }
).refine(
  (data) => {
    // Ensure bets are on opposite sides
    return data.betA.selectedSide !== data.betB.selectedSide;
  },
  {
    message: "As apostas devem ser em lados opostos",
    path: ["betB", "selectedSide"],
  }
);

export type SingleBetOCR = z.infer<typeof singleBetOCRSchema>;
export type OCRData = z.infer<typeof ocrDataSchema>;

// Helper functions for bet pair calculations
export const calculatePairMetrics = (stakeA: number, stakeB: number, profitA: number, profitB: number) => {
  const totalStake = stakeA + stakeB;
  const profitPercentageA = totalStake > 0 ? ((profitA - totalStake) / totalStake) * 100 : 0;
  const profitPercentageB = totalStake > 0 ? ((profitB - totalStake) / totalStake) * 100 : 0;
  
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
  
  if (betA.selectedSide === betB.selectedSide) {
    errors.push("Apostas devem ser em lados opostos");
  }
  
  if (betA.betPosition === betB.betPosition) {
    errors.push("Posições das apostas devem ser diferentes (A e B)");
  }
  
  return errors;
};
