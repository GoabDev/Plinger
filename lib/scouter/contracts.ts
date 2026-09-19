import { z } from "zod";
import type { ScouterProfile } from "../dashboard/scouters";

export const githubPatSchema = z.object({
  kind: z.literal("pat"),
  pat: z
    .string()
    .trim()
    .max(500, "Personal access token is too long")
    .regex(/^(?:ghp_|github_pat_|gho_|ghu_|ghs_)[A-Za-z0-9_]{20,}$/, "Enter a valid GitHub personal access token"),
});

export const bankDetailsSchema = z.object({
  kind: z.literal("bank"),
  bankName: z.string().trim().min(1, "Enter your bank name").max(120, "Bank name is too long"),
  accountName: z.string().trim().min(1, "Enter the name on the account").max(120, "Account name is too long"),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, "Enter a valid account number"),
});

export const scouterUpdateSchema = z.discriminatedUnion("kind", [githubPatSchema, bankDetailsSchema]);
export const proofReviewSchema = z.object({ status: z.enum(["confirmed", "rejected", "pending"]) });

const proofTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
export const withdrawalProofFormSchema = z.object({
  proof: z
    .custom<FileList>((value) => typeof FileList !== "undefined" && value instanceof FileList && value.length === 1, "Choose a withdrawal proof")
    .refine((files) => Boolean(files.item(0)?.size && files.item(0)!.size <= 10 * 1024 * 1024), "Upload a file up to 10 MB")
    .refine((files) => proofTypes.includes(files.item(0)?.type ?? ""), "Upload a PNG, JPG, WebP, or PDF"),
});

export type GithubPatInput = z.infer<typeof githubPatSchema>;
export type BankDetailsInput = z.infer<typeof bankDetailsSchema>;
export type ProofReviewInput = z.infer<typeof proofReviewSchema>;
export type WithdrawalProofFormInput = z.infer<typeof withdrawalProofFormSchema>;

export type ScouterPrivateState = {
  patUploaded: boolean;
  patUpdatedAt: string | null;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankUpdatedAt: string | null;
};

export type WithdrawalProofSummary = {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

export type ScouterPortalData = {
  work: ScouterProfile | null;
  profile: ScouterPrivateState;
  proofs: WithdrawalProofSummary[];
};
