/**
 * Data access for {@link Feedback} records — user-submitted support requests
 * (bug reports, feature requests, general issues) triaged by super-admins.
 *
 * Writes are inherently tenant-scoped: the caller passes `companyId` straight
 * from the authenticated session, never from request input. The user-facing
 * read scopes by both `userId` and `companyId`; the admin list is the same
 * unscoped super-admin view as `getCompaniesPaginated`.
 */
import "server-only";

import type { Feedback, FeedbackStatus, FeedbackType } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE } from "@/lib/config";
import { prisma } from "@/lib/prisma";

/** Fields a user can set when submitting feedback. */
export interface CreateFeedbackData {
  type: FeedbackType;
  title: string;
  description: string;
}

/** A feedback row annotated with its submitter and company names (admin view). */
export type FeedbackWithSubmitter = Prisma.FeedbackGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    company: { select: { name: true } };
  };
}>;

/** How many submissions to show per page in the admin list. */
export const FEEDBACK_PAGE_SIZE = PAGE_SIZE;

/** Filtering/pagination options for the admin list. */
export interface FeedbackFilters {
  page?: number;
  type?: FeedbackType | null;
  status?: FeedbackStatus | null;
}

/** Returns true for Prisma's "record not found" error (P2025). */
function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

/**
 * Records a new feedback submission. `companyId` is the submitting user's own
 * tenant (null for company-less submitters such as a SUPER_ADMIN), so the write
 * can never target another tenant.
 */
export async function createFeedback(
  data: CreateFeedbackData,
  userId: string,
  companyId: string | null,
): Promise<Feedback> {
  return prisma.feedback.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      userId,
      companyId,
    },
  });
}

/**
 * Returns a user's own submissions, newest first. Scoped to both the user and
 * their tenant so one company's members can never read another's.
 */
export async function getFeedbackByUser(
  userId: string,
  companyId: string | null,
): Promise<Feedback[]> {
  return prisma.feedback.findMany({
    where: { userId, ...(companyId ? { companyId } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns a paginated, filterable list of all submissions across all tenants
 * (super-admin view), each annotated with the submitter's and company's names.
 * Ordered most-recent-first.
 */
export async function getAllFeedback(
  filters: FeedbackFilters = {},
): Promise<{ feedback: FeedbackWithSubmitter[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = FEEDBACK_PAGE_SIZE;
  const skip = (page - 1) * limit;

  const where = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [feedback, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
        company: { select: { name: true } },
      },
    }),
    prisma.feedback.count({ where }),
  ]);

  return { feedback, total };
}

/**
 * Updates a submission's triage status (super-admin action).
 *
 * @throws {Error} If no feedback with `feedbackId` exists.
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
): Promise<Feedback> {
  try {
    return await prisma.feedback.update({
      where: { id: feedbackId },
      data: { status },
    });
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new Error(`Feedback "${feedbackId}" not found.`);
    }
    throw error;
  }
}
