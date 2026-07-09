-- Flag: ripubblica automaticamente il blog anche come post su Facebook alla pubblicazione.
ALTER TABLE "GeneratedContent" ADD COLUMN "alsoFacebook" BOOLEAN NOT NULL DEFAULT false;
