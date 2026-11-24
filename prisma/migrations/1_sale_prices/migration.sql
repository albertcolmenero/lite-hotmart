-- CreateEnum
CREATE TYPE "SaleDuration" AS ENUM ('periods', 'forever');

-- AlterTable
ALTER TABLE "PlanPrice" ADD COLUMN     "saleCouponFingerprint" TEXT,
ADD COLUMN     "saleDuration" "SaleDuration",
ADD COLUMN     "saleEndsAt" TIMESTAMP(3),
ADD COLUMN     "salePeriods" INTEGER,
ADD COLUMN     "salePriceCents" INTEGER,
ADD COLUMN     "saleStartsAt" TIMESTAMP(3),
ADD COLUMN     "saleStripeCouponId" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "saleCouponFingerprint" TEXT,
ADD COLUMN     "saleEndsAt" TIMESTAMP(3),
ADD COLUMN     "salePriceCents" INTEGER,
ADD COLUMN     "saleStartsAt" TIMESTAMP(3),
ADD COLUMN     "saleStripeCouponId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "discountCents" INTEGER,
ADD COLUMN     "discountEndsAt" TIMESTAMP(3);
