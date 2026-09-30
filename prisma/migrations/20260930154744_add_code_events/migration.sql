-- CreateTable
CREATE TABLE "code_events" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "code_events_roomId_createdAt_idx" ON "code_events"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "code_events" ADD CONSTRAINT "code_events_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "code_events" ADD CONSTRAINT "code_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
