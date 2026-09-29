/*
  Warnings:

  - You are about to drop the column `problemId` on the `messages` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "interview_status" AS ENUM ('ACTIVE', 'COMPLETED');

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_problemId_fkey";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "problemId";

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "problemId" TEXT,
    "status" "interview_status" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_snapshots" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interviews_interviewerId_startedAt_idx" ON "interviews"("interviewerId", "startedAt");

-- CreateIndex
CREATE INDEX "interviews_candidateId_startedAt_idx" ON "interviews"("candidateId", "startedAt");

-- CreateIndex
CREATE INDEX "code_snapshots_interviewId_takenAt_idx" ON "code_snapshots"("interviewId", "takenAt");

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_snapshots" ADD CONSTRAINT "code_snapshots_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_snapshots" ADD CONSTRAINT "code_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
