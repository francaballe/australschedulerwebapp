-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateTable
CREATE TABLE "app"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "firstname" TEXT,
    "lastname" TEXT,
    "lastlogin" TIMESTAMPTZ,
    "createddate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isblocked" BOOLEAN DEFAULT false,
    "userroleid" INTEGER,
    "phone" TEXT,
    "siteid" INTEGER DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."roles" (
    "id" INTEGER NOT NULL,
    "name" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."sites" (
    "id" SERIAL NOT NULL,
    "name" TEXT,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."positions" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "color" TEXT,
    "starttime" TIME,
    "endtime" TIME,
    "eliminated" BOOLEAN DEFAULT false,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."shifts" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "position_id" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER NOT NULL,
    "to_be_deleted" BOOLEAN NOT NULL DEFAULT false,
    "starttime" TIME,
    "endtime" TIME,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."user_availability" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."user_push_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."messages" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."confirmedweeks" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "confirmedweeks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "app"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_availability_user_id_date_key" ON "app"."user_availability"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "user_push_tokens_user_id_token_key" ON "app"."user_push_tokens"("user_id", "token");

-- CreateIndex
CREATE INDEX "idx_messages_created_at" ON "app"."messages"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_messages_user_id" ON "app"."messages"("user_id");

-- CreateIndex
CREATE INDEX "idx_messages_user_unread" ON "app"."messages"("user_id", "read");

-- AddForeignKey
ALTER TABLE "app"."users" ADD CONSTRAINT "users_userroleid_fkey" FOREIGN KEY ("userroleid") REFERENCES "app"."roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."users" ADD CONSTRAINT "users_siteid_fkey" FOREIGN KEY ("siteid") REFERENCES "app"."sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."shifts" ADD CONSTRAINT "shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."shifts" ADD CONSTRAINT "shifts_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "app"."positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."user_availability" ADD CONSTRAINT "user_availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."user_push_tokens" ADD CONSTRAINT "user_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."confirmedweeks" ADD CONSTRAINT "confirmedweeks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
