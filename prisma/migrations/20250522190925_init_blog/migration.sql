-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "author" VARCHAR(100) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "coverImg" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "First Name" TEXT NOT NULL,
    "Last Name" TEXT NOT NULL,
    "Email Address" TEXT NOT NULL,
    "Phone Number" TEXT NOT NULL,
    "Address" TEXT,
    "City" TEXT,
    "State" TEXT,
    "Zip Code" TEXT,
    "Agent Type" TEXT,
    "Agent Status" TEXT,
    "Agent License" TEXT,
    "Agent License Expiration" TIMESTAMP(3),
    "Pipeline Stage" TEXT,
    "Notes" TEXT,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "First Name" TEXT NOT NULL,
    "Last Name" TEXT NOT NULL,
    "Email Address" TEXT NOT NULL,
    "Phone Number" TEXT NOT NULL,
    "Address" TEXT,
    "City" TEXT,
    "State" TEXT,
    "Zip Code" TEXT,
    "Partner Type" TEXT,
    "Partner Status" TEXT,
    "Partner License" TEXT,
    "Partner License Expiration" TIMESTAMP(3),
    "Pipeline Stage" TEXT,
    "Notes" TEXT,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "First Name" TEXT NOT NULL,
    "Last Name" TEXT NOT NULL,
    "Email Address" TEXT NOT NULL,
    "Status" TEXT,
    "Labels" TEXT,
    "Quality Score" INTEGER,
    "Phone Number" TEXT NOT NULL,
    "Address" TEXT,
    "City" TEXT,
    "State" TEXT,
    "Zip Code" TEXT,
    "Agent Assigned" TEXT,
    "Partner Assigned" TEXT,
    "Registered" TIMESTAMP(3),
    "Source" TEXT,
    "Last Login" TIMESTAMP(3),
    "Login Count" INTEGER,
    "Last Touch Type" TEXT,
    "Last Touch Date" TIMESTAMP(3),
    "Last Touch Notes" TEXT,
    "Average Price" INTEGER,
    "Median Price" INTEGER,
    "Favorite City" TEXT,
    "Timeframe" TEXT,
    "Property Inquiries" INTEGER,
    "Favorite Properties" INTEGER,
    "Property Views" INTEGER,
    "Property Favorites" INTEGER,
    "Saved Searches" INTEGER,
    "Pre-Qualified for Mortgage" BOOLEAN,
    "House to Sell" BOOLEAN,
    "First Time Buyer" BOOLEAN,
    "IP" TEXT,
    "Buyer/Seller" TEXT,
    "Opted In Email" BOOLEAN,
    "Opted In Text" BOOLEAN,
    "Pipeline Stage" TEXT,
    "Notes" TEXT,
    "Notes 2" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AgentPartners" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AgentPartners_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_Email Address_key" ON "Agent"("Email Address");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_Email Address_key" ON "Partner"("Email Address");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_Email Address_key" ON "Lead"("Email Address");

-- CreateIndex
CREATE INDEX "_AgentPartners_B_index" ON "_AgentPartners"("B");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_Agent Assigned_fkey" FOREIGN KEY ("Agent Assigned") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_Partner Assigned_fkey" FOREIGN KEY ("Partner Assigned") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentPartners" ADD CONSTRAINT "_AgentPartners_A_fkey" FOREIGN KEY ("A") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AgentPartners" ADD CONSTRAINT "_AgentPartners_B_fkey" FOREIGN KEY ("B") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
