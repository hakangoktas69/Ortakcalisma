-- Yeni kullanıcılar için varsayılan; mevcut kullanıcıların tercihlerine e-Defter eklenir
ALTER TABLE "User" ALTER COLUMN "notifyCategories" SET DEFAULT ARRAY['TEBLIGAT', 'SGK_RAPOR', 'BEYANNAME_SON_GUN', 'BEYANNAME_GECIKTI', 'EDEFTER']::"NotificationCategory"[];
UPDATE "User" SET "notifyCategories" = array_append("notifyCategories", 'EDEFTER'::"NotificationCategory") WHERE NOT ('EDEFTER'::"NotificationCategory" = ANY("notifyCategories"));
