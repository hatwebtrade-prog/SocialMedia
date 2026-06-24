export const EMAIL_FORMATS = ["NEWSLETTER", "PROMO_EMAIL", "EDUCAZIONALE"] as const;
export type EmailFormatValue = (typeof EMAIL_FORMATS)[number];
