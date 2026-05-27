import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op } from "sequelize";
import { Sequelize } from "sequelize-typescript";
import { v4 as uuidv4 } from "uuid";
import { GiftCard } from "./gift-card.entity";
import { callHTTPException } from "src/shared/exceptions";
import { sendEmail, renderTemplateFromDB } from "src/shared/services/sendEmail.service";
import { EmailTemplate } from "src/email-templates/email-template.entity";
import { Env } from "src/shared/config";
import { RedeemGiftCardDto, ValidateGiftCardDto } from "./dto/gift-card.dto";

@Injectable()
export class GiftCardService {
  constructor(
    @InjectModel(GiftCard)
    private giftCardModel: typeof GiftCard,
    private sequelize: Sequelize
  ) {}

  /**
   * Generate a unique gift card code in format: NU-VISA-XXXXXX
   */
  private async generateUniqueCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      // Generate 6 random alphanumeric characters
      const randomPart = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()
        .padEnd(6, "0")
        .substring(0, 6);

      code = `NU-VISA-${randomPart}`;

      // Check if code already exists
      const existing = await this.giftCardModel.findOne({
        where: { code },
      });

      if (!existing) {
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      callHTTPException("Failed to generate unique gift card code");
    }

    return code;
  }

  /**
   * Create a gift card after successful payment
   * Generates separate unique codes for each gift card based on quantity
   */
  async createGiftCard(data: {
    email: string;
    amount: string;
    quantity?: number;
    stripe_session_id?: string;
    stripe_payment_intent_id?: string;
  }): Promise<{ primary: GiftCard; emailSent: boolean }> {
    try {
      const quantity = Math.max(1, Number(data.quantity) || 1);
      const totalAmount = this.parseGiftCardAmount(data.amount);
      const perCardAmount = (totalAmount / quantity).toFixed(2);

      console.log('🎁 Creating Gift Card:');
      console.log('   📧 Email:', data.email);
      console.log('   💰 Total amount:', data.amount);
      console.log('   💳 Per-card amount:', perCardAmount);
      console.log('   📦 Quantity (number of gift cards):', quantity);
      console.log('   🔑 Stripe Session ID:', data.stripe_session_id || 'N/A');
      console.log('   💳 Stripe Payment Intent ID:', data.stripe_payment_intent_id || 'N/A');
      
      // Generate a unique purchase group ID (UUID) to link all gift cards from this purchase
      const purchase_group_id = uuidv4();
      
      const giftCards: GiftCard[] = [];
      
      // Generate separate codes for each gift card
      for (let i = 0; i < quantity; i++) {
        const code = await this.generateUniqueCode();
        console.log(`   🎫 Generated Code ${i + 1}/${quantity}:`, code);

        const giftCard = await this.giftCardModel.create({
          code,
          email: data.email,
          amount: perCardAmount,
          stripe_session_id: data.stripe_session_id || null,
          stripe_payment_intent_id: data.stripe_payment_intent_id || null,
          purchased_at: new Date(),
          is_used: false,
          quantity: 1, // Each card represents 1 gift card
          purchase_group_id: purchase_group_id, // Link all cards from same purchase
        });

        giftCards.push(giftCard);
        console.log(`   ✅ Gift card ${i + 1}/${quantity} created in database with ID:`, giftCard.id);
      }

      const emailSent = await this.sendGiftCardEmails(giftCards);

      // Log purchase group and codes for easier tracing in logs
      console.log('   📦 Purchase group ID:', purchase_group_id);
      console.log('   🧾 Created codes:', giftCards.map(gc => gc.code).join(', '));

      return { primary: giftCards[0], emailSent };
    } catch (error) {
      console.error("Error creating gift card:", error);
      callHTTPException(`Failed to create gift card: ${error.message}`);
    }
  }

  /**
   * Idempotent fulfillment after Stripe checkout (webhook backup for client redirect).
   */
  async fulfillGiftCardPurchase(data: {
    email: string;
    amount: string;
    quantity?: number;
    stripe_session_id?: string;
    stripe_payment_intent_id?: string;
  }): Promise<{ codes: string[]; created: boolean; emailSent: boolean }> {
    const quantity = Math.max(1, Number(data.quantity) || 1);
    const sessionId = data.stripe_session_id?.trim() || null;
    const paymentIntentId = data.stripe_payment_intent_id?.trim() || null;

    const lookupConditions: Array<Record<string, string>> = [];
    if (sessionId) {
      lookupConditions.push({ stripe_session_id: sessionId });
    }
    if (paymentIntentId) {
      lookupConditions.push({ stripe_payment_intent_id: paymentIntentId });
    }

    let existing: GiftCard[] = [];
    if (lookupConditions.length > 0) {
      existing = await this.giftCardModel.findAll({
        where: { [Op.or]: lookupConditions },
        order: [["purchased_at", "ASC"]],
      });
    }

    if (existing.length > 0) {
      console.log(
        `🎁 Gift card fulfill: resending email for ${existing.length} existing code(s)`,
      );
      const emailSent = await this.sendGiftCardEmails(existing);
      return {
        codes: existing.map((card) => card.code),
        created: false,
        emailSent,
      };
    }

    console.log("🎁 Gift card fulfill: creating new gift card(s)");
    const { primary: firstCard, emailSent } = await this.createGiftCard({
      email: data.email,
      amount: data.amount,
      quantity,
      stripe_session_id: sessionId || undefined,
      stripe_payment_intent_id: paymentIntentId || undefined,
    });

    const groupId = firstCard.purchase_group_id;
    const createdCards = groupId
      ? await this.giftCardModel.findAll({
          where: { purchase_group_id: groupId },
          order: [["purchased_at", "ASC"]],
        })
      : [firstCard];

    return {
      codes: createdCards.map((card) => card.code),
      created: true,
      emailSent,
    };
  }

  /**
   * Send one email per purchase with all redemption codes from that purchase.
   * @returns true if the email was accepted by SMTP
   */
  private async sendGiftCardEmails(giftCards: GiftCard[]): Promise<boolean> {
    const giftCardsArray = Array.isArray(giftCards) ? giftCards : [giftCards];
    if (giftCardsArray.length === 0) {
      return false;
    }

    return this.sendGiftCardPurchaseEmail(giftCardsArray);
  }

  private buildGiftCardCodesHtml(codes: string[]): string {
    const codeBoxStyle =
      "background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 12px 0; text-align: center;";
    const codeTextStyle =
      "margin:0;font-size:24px;font-weight:700;letter-spacing:1px;color:#000;font-family:'Courier New',monospace;";

    if (codes.length === 1) {
      return `<div style="${codeBoxStyle}"><p style="${codeTextStyle}">${codes[0]}</p></div>`;
    }

    return codes
      .map(
        (code, index) =>
          `<div style="${codeBoxStyle}"><p style="margin:0 0 6px;font-size:12px;color:#666;">Gift card ${index + 1}</p><p style="${codeTextStyle}">${code}</p></div>`,
      )
      .join("");
  }

  /**
   * Send a gift card purchase email containing one or more redemption codes.
   */
  private async sendGiftCardPurchaseEmail(
    giftCards: GiftCard[],
  ): Promise<boolean> {
    const recipientEmail = giftCards[0]?.email;
    if (!recipientEmail) {
      return false;
    }

    const codes = giftCards.map((card) => card.code);
    const unitAmounts = await Promise.all(
      giftCards.map((card) => this.resolveGiftCardUnitAmount(card)),
    );
    const quantity = giftCards.length;
    const perCardAmount = unitAmounts[0] || "159";
    const totalAmount = unitAmounts
      .reduce((sum, amount) => sum + this.parseGiftCardAmount(amount), 0)
      .toFixed(2);
    const amountLabel =
      quantity === 1
        ? `£${perCardAmount}`
        : `£${perCardAmount} each (£${totalAmount} total)`;
    const codesHtml = this.buildGiftCardCodesHtml(codes);
    const introLine =
      quantity === 1
        ? "Your gift card redemption code for 1 traveller is:"
        : `Your ${quantity} gift card redemption codes (1 traveller each) are:`;

    try {
      console.log("📧 Sending Gift Card Email:");
      console.log("   📧 To:", recipientEmail);
      console.log("   🎫 Codes:", codes.join(", "));
      console.log("   💰 Amount:", amountLabel);

      let template = null;
      try {
        template = await EmailTemplate.findOne({
          where: { key: "gift_card_purchase", isActive: true },
        });
      } catch (findError) {
        console.error("❌ Error querying gift_card_purchase template:", findError);
      }

      let subject =
        quantity === 1
          ? "Your NUvisa Gift Card"
          : `Your NUvisa Gift Cards (${quantity} codes)`;
      let emailBody = `
        <p>Hi,</p>
        <p>Thank you for your gift card purchase with NUvisa.</p>
        <p>${introLine}</p>
        ${codesHtml}
        <p>Amount: ${amountLabel}</p>
        <p>Redeem your gift card${quantity === 1 ? "" : "s"} at <a href="https://www.nuvisa.co.uk">nuvisa.co.uk</a>.</p>
        <p>Thank you!</p>
      `;

      if (template) {
        const dynamicData = {
          code: codes.join(", "),
          codes,
          codesHtml,
          amount: quantity === 1 ? perCardAmount : totalAmount,
          quantity,
          email: recipientEmail,
        };

        try {
          const rendered = await renderTemplateFromDB(
            "gift_card_purchase",
            dynamicData,
            template,
          );
          subject =
            quantity === 1
              ? rendered.subject
              : rendered.subject.replace(
                  /Redemption Code/i,
                  `${quantity} Redemption Codes`,
                );
          emailBody = rendered.emailBody
            .replace(/Your gift card redemption code is:/i, introLine)
            .replace(
              /Your gift card redemption code for 1 traveller is:/i,
              introLine,
            );

          if (quantity > 1) {
            emailBody = emailBody.replace(
              /<p style="font-size: 32px[^>]*>[\s\S]*?<\/p>/i,
              codesHtml,
            );
            emailBody = emailBody.replace(
              /<strong>Purchase Amount:<\/strong> £[^<]+/i,
              `<strong>Purchase Amount:</strong> ${amountLabel}`,
            );
            emailBody = emailBody.replace(
              /This code can only be used once/i,
              "Each code can only be used once",
            );
            emailBody = emailBody.replace(
              /You can use this code during checkout/i,
              "You can use these codes during checkout",
            );
          }

          if (!codes.some((code) => emailBody.includes(code))) {
            emailBody = emailBody.replace(
              /(<p>Thank you for your gift card purchase!<\/p>)/i,
              `$1<p>${introLine}</p>${codesHtml}`,
            );
          }
        } catch (renderError) {
          console.error("   ❌ Template rendering failed:", renderError?.message);
        }
      } else {
        console.warn(
          "⚠️ Gift card email template not found. Sending fallback gift card email.",
        );
      }

      const giftCardImageCid = "gift-card-image";
      const giftCardImageHtml = `<div style="text-align: center; margin: 24px 0 12px 0;">
          <img src="cid:${giftCardImageCid}" alt="NUvisa gift card" style="max-width: 100%; height: auto; border-radius: 12px; display: inline-block; box-shadow: 0 8px 20px rgba(0,0,0,0.08);">
        </div>`;

      let finalEmailBody = emailBody;
      if (!finalEmailBody.includes(giftCardImageCid)) {
        finalEmailBody = `${giftCardImageHtml}${finalEmailBody}`;
      }

      const footerContent = await this.getEmailFooterContent();

      try {
        await sendEmail(
          {
            emailAddress: recipientEmail,
            subject,
            body: finalEmailBody,
            excludeDecorativeImage: false,
            inlineImages: [
              {
                filename: "gift-card.png",
                path: "https://www.nuvisa.co.uk/image/gitftnewcard.png",
                cid: giftCardImageCid,
              },
            ],
          },
          footerContent,
        );
        console.log("   ✅ Gift card email sent successfully!");
        return true;
      } catch (emailSendError) {
        console.error("   ❌ Email send failed!", emailSendError?.message);
        return false;
      }
    } catch (error) {
      console.error("❌ Error sending gift card email:", error);
      return false;
    }
  }


  /**
   * Get email footer content (logo, social links, etc.)
   */
  private async getEmailFooterContent(): Promise<any> {
    try {
      let logoUrl = "";
      let twitter = "#";
      let facebook = "#";
      let instagram = "#";
      let linkedin = "#";
      let teamSignature = "— Team NUvisa";
      let companyInfo: string[] = [];

      try {
        const logoContent = (await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = 'email_logo_url' LIMIT 1
        `)) as any[];
        logoUrl = logoContent?.[0]?.[0]?.value || "";

        if (!logoUrl) {
          logoUrl = "/image/logo.png";
        }

        const socialLinks = (await this.sequelize.query(`
          SELECT key, value FROM site_content WHERE key IN ('social_twitter', 'social_facebook', 'social_instagram', 'social_linkedin')
        `)) as any[];

        socialLinks.forEach((link: any) => {
          const row = Array.isArray(link) ? link[0] : link;
          const key = row?.key?.replace("social_", "") || "";
          const value = row?.value || "";
          if (key === "twitter") twitter = value || "#";
          if (key === "facebook") facebook = value || "#";
          if (key === "instagram") instagram = value || "#";
          if (key === "linkedin") linkedin = value || "#";
        });

        const teamSignatureResult = (await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = 'email_team_signature' LIMIT 1
        `)) as any[];
        teamSignature = teamSignatureResult?.[0]?.[0]?.value || "— Team NUvisa";

        const companyInfoResult = (await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = 'email_company_info' LIMIT 1
        `)) as any[];
        try {
          const companyInfoValue = companyInfoResult?.[0]?.[0]?.value;
          if (companyInfoValue) {
            companyInfo = JSON.parse(companyInfoValue);
          }
        } catch {
          const companyInfoValue = companyInfoResult?.[0]?.[0]?.value;
          if (companyInfoValue) {
            companyInfo = [companyInfoValue];
          }
        }
      } catch (queryError) {
        logoUrl = "";
      }

      if (!logoUrl) {
        logoUrl = "/image/logo.png";
      }

      const baseUrl = Env.WEBSITE_URL || "https://nuvisa.co.uk";
      const helpCentreUrl = `${baseUrl}/get-the-visa#faq`;

      if (companyInfo.length === 0) {
        companyInfo = [
          'NUvisa is an independent company that offers efficient and professional assistance in obtaining visas and other travel products online fast. The company and site are not associated with any governmental agency. VAT registration no: 412344437 | D-U-N-S Number: 227538057 7. | ICO registration number: ZB732764. Registered Office: 2 Brunel Way, The Future Works, Slough, Greater London, England, SL1 1FQ | <a href="mailto:support@nuvisa.co.uk" style="color: #000000; text-decoration: underline;">support@nuvisa.co.uk</a> | +44 7388120901',
        ];
      }

      return {
        logo: logoUrl,
        twitter,
        facebook,
        instagram,
        linkedin,
        teamSignature: teamSignature || "— Team NUvisa",
        companyInfo,
      };
    } catch (error) {
      return {
        logo: "",
        twitter: "#",
        facebook: "#",
        instagram: "#",
        linkedin: "#",
        companyInfo: [],
      };
    }
  }

  private parseGiftCardAmount(amount: string | number): number {
    const parsed = parseFloat(String(amount).replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 159;
  }

  /**
   * Returns the per-card amount. Legacy purchases stored the checkout total on every row.
   */
  private async resolveGiftCardUnitAmount(giftCard: GiftCard): Promise<string> {
    const groupId = giftCard.purchase_group_id;
    if (!groupId) {
      return String(giftCard.amount);
    }

    const siblings = await this.giftCardModel.findAll({
      where: { purchase_group_id: groupId },
    });
    if (siblings.length <= 1) {
      return String(giftCard.amount);
    }

    const stored = this.parseGiftCardAmount(giftCard.amount);
    const allSameAmount = siblings.every(
      (s) => String(s.amount) === String(giftCard.amount),
    );
    const expectedTotal = stored * siblings.length;
    const looksLikeTotalOnEach =
      allSameAmount && stored >= expectedTotal * 0.99;

    if (looksLikeTotalOnEach) {
      return (stored / siblings.length).toFixed(2);
    }

    return String(giftCard.amount);
  }

  private getGiftCardApplicationError(params: {
    giftCardAmount: number;
    packagePrice?: number;
    travelerCount?: number;
    appliedGiftCardCount?: number;
    appliedGiftCardsTotal?: number;
  }): string | null {
    const {
      giftCardAmount,
      packagePrice,
      travelerCount,
      appliedGiftCardCount = 0,
      appliedGiftCardsTotal = 0,
    } = params;

    if (packagePrice === undefined || travelerCount === undefined) {
      return null;
    }

    const travelers = Math.max(0, Math.floor(Number(travelerCount) || 0));
    if (travelers < 1) {
      return "Add at least one traveller to apply a gift card.";
    }

    const applied = Math.max(0, Math.floor(Number(appliedGiftCardCount) || 0));
    const nextCount = applied + 1;

    if (nextCount > travelers) {
      return `You can apply at most ${travelers} gift card${travelers === 1 ? "" : "s"} for ${travelers} traveller${travelers === 1 ? "" : "s"}.`;
    }

    const alreadyAppliedTotal = Math.max(0, Number(appliedGiftCardsTotal) || 0);
    const requiredTotal = alreadyAppliedTotal + giftCardAmount;
    const packageTotal = Number(packagePrice) || 0;
    if (packageTotal < requiredTotal) {
      const remaining = Math.max(0, packageTotal - alreadyAppliedTotal);
      if (alreadyAppliedTotal > 0) {
        return `Your remaining package balance (£${remaining.toFixed(2)}) is not enough to apply this gift card (£${giftCardAmount.toFixed(2)}).`;
      }
      return `Your package total must be at least £${giftCardAmount.toFixed(2)} to apply this gift card. Your current package total is £${packageTotal.toFixed(2)}.`;
    }

    return null;
  }

  /**
   * Validate a gift card code
   */
  async validateGiftCard(dto: ValidateGiftCardDto): Promise<any> {
    try {
      const giftCard = await this.giftCardModel.findOne({
        where: { code: dto.code },
      });

      if (!giftCard) {
        return {
          valid: false,
          message: "Invalid gift card code",
        };
      }

      if (giftCard.is_used) {
        return {
          valid: false,
          message: "This gift card has already been used",
        };
      }

      const cardAmount = this.parseGiftCardAmount(
        await this.resolveGiftCardUnitAmount(giftCard),
      );
      const eligibilityError = this.getGiftCardApplicationError({
        giftCardAmount: cardAmount,
        packagePrice: dto.packagePrice,
        travelerCount: dto.travelerCount,
        appliedGiftCardCount: dto.appliedGiftCardCount,
      });

      if (eligibilityError) {
        return {
          valid: false,
          message: eligibilityError,
        };
      }

      const unitAmount = await this.resolveGiftCardUnitAmount(giftCard);

      return {
        valid: true,
        message: "Gift card is valid",
        giftCard: {
          code: giftCard.code,
          amount: unitAmount,
          quantity: 1,
        },
        benefits: {
          freeTraveler: 1,
          freeInsurance: 1,
        },
      };
    } catch (error) {
      callHTTPException(`Failed to validate gift card: ${error.message}`);
    }
  }

  /**
   * Redeem a gift card code
   */
  async redeemGiftCard(
    dto: RedeemGiftCardDto,
    userId?: string,
    userEmail?: string
  ): Promise<any> {
    try {
      const giftCard = await this.giftCardModel.findOne({
        where: { code: dto.code },
      });

      if (!giftCard) {
        callHTTPException("Invalid gift card code");
      }

      if (giftCard.is_used) {
        callHTTPException("This gift card has already been used");
      }

      const cardAmount = this.parseGiftCardAmount(
        await this.resolveGiftCardUnitAmount(giftCard),
      );
      const eligibilityError = this.getGiftCardApplicationError({
        giftCardAmount: cardAmount,
        packagePrice: dto.packagePrice,
        travelerCount: dto.travelerCount,
        appliedGiftCardCount: dto.appliedGiftCardCount,
        appliedGiftCardsTotal: dto.appliedGiftCardsTotal,
      });

      if (eligibilityError) {
        callHTTPException(eligibilityError);
      }

      const unitAmount = await this.resolveGiftCardUnitAmount(giftCard);

      // Mark as used
      await giftCard.update({
        is_used: true,
        used_at: new Date(),
        used_by_user_id: userId || null,
        used_by_email: userEmail || dto.email || null,
      });

      const redeemEmail = userEmail || dto.email || giftCard.email;
      if (redeemEmail) {
        try {
          await sendEmail({
            emailAddress: redeemEmail,
            subject: "NUvisa — Gift card redeemed successfully",
            body: `<div style="font-family: Arial, sans-serif; color: #111;">
              <h2 style="color: #7350FF;">Gift card redeemed</h2>
              <p>Your NUvisa gift card <strong>${giftCard.code}</strong> has been applied at checkout.</p>
              <p>Thank you for choosing NUvisa.</p>
            </div>`,
          });
        } catch (emailErr) {
          console.error("Gift card redeem confirmation email failed:", emailErr);
        }
      }

      return {
        success: true,
        message: "Gift card redeemed successfully",
        giftCard: {
          code: giftCard.code,
          amount: unitAmount,
          quantity: giftCard.quantity || 1,
        },
        benefits: {
          freeTraveler: 1,
          freeInsurance: 1,
        },
      };
    } catch (error) {
      if (error.message.includes("Invalid") || error.message.includes("already been used")) {
        throw error;
      }
      callHTTPException(`Failed to redeem gift card: ${error.message}`);
    }
  }

  /**
   * Get gift card by code
   */
  async getGiftCardByCode(code: string): Promise<GiftCard | null> {
    try {
      return await this.giftCardModel.findOne({
        where: { code },
      });
    } catch (error) {
      return null;
    }
  }
}

