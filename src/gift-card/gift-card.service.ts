import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Sequelize } from "sequelize-typescript";
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
   * Stores the quantity (number of gift cards purchased) in the single gift card record
   */
  async createGiftCard(data: {
    email: string;
    amount: string;
    quantity?: number;
    stripe_session_id?: string;
    stripe_payment_intent_id?: string;
  }): Promise<GiftCard> {
    try {
      const quantity = data.quantity || 1;
      
      console.log('🎁 Creating Gift Card:');
      console.log('   📧 Email:', data.email);
      console.log('   💰 Amount:', data.amount);
      console.log('   📦 Quantity (number of gift cards):', quantity);
      console.log('   🔑 Stripe Session ID:', data.stripe_session_id || 'N/A');
      console.log('   💳 Stripe Payment Intent ID:', data.stripe_payment_intent_id || 'N/A');
      
      const code = await this.generateUniqueCode();
      console.log('   🎫 Generated Code:', code);

      const giftCard = await this.giftCardModel.create({
        code,
        email: data.email,
        amount: data.amount,
        stripe_session_id: data.stripe_session_id || null,
        stripe_payment_intent_id: data.stripe_payment_intent_id || null,
        purchased_at: new Date(),
        is_used: false,
        quantity: quantity,
        purchase_group_id: null, // Not needed for single card approach
      });

      console.log('   ✅ Gift card created in database with ID:', giftCard.id);
      console.log('   📦 Quantity stored:', giftCard.quantity);

      // Send email with the single code
      await this.sendGiftCardEmail(giftCard);

      return giftCard;
    } catch (error) {
      console.error("Error creating gift card:", error);
      callHTTPException(`Failed to create gift card: ${error.message}`);
    }
  }

  /**
   * Send gift card email with redemption code
   */
  private async sendGiftCardEmail(giftCard: GiftCard): Promise<void> {
    try {
      console.log('📧 Sending Gift Card Email:');
      console.log('   📧 To:', giftCard.email);
      console.log('   🎫 Code:', giftCard.code);
      console.log('   💰 Amount:', giftCard.amount);
      console.log('   📦 Quantity:', giftCard.quantity || 1);
      
      // Get email template from database
      const template = await EmailTemplate.findOne({
        where: { key: "gift_card_purchase", isActive: true },
      });

      if (!template) {
        console.error("❌ Gift card email template not found");
        // Don't throw error, just log - email will be sent via Stripe receipt
        return;
      }

      const dynamicData = {
        code: giftCard.code,
        amount: giftCard.amount,
        quantity: giftCard.quantity || 1,
        email: giftCard.email,
      };

      const { subject, emailBody } = await renderTemplateFromDB(
        "gift_card_purchase",
        dynamicData,
        template
      );

      // Get footer content
      const footerContent = await this.getEmailFooterContent();

      // Send email
      await sendEmail(
        {
          emailAddress: giftCard.email,
          subject,
          body: emailBody,
          excludeDecorativeImage: false,
        },
        footerContent
      );
      
      console.log('   ✅ Gift card email sent successfully');
    } catch (error) {
      console.error("❌ Error sending gift card email:", error);
      console.error("📧 Gift card email details:", {
        recipient: giftCard.email,
        code: giftCard.code,
        quantity: giftCard.quantity || 1,
        amount: giftCard.amount,
        errorMessage: error.message,
        errorCode: error.code,
      });
      // Don't throw error - gift card is already created, email failure shouldn't break the flow
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
          `If you have any questions, please visit our <a href="${helpCentreUrl}" style="color: #000000; text-decoration: underline;">Help Centre</a>.`,
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

      return {
        valid: true,
        message: "Gift card is valid",
        giftCard: {
          code: giftCard.code,
          amount: giftCard.amount,
          quantity: giftCard.quantity || 1,
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

      // Mark as used
      await giftCard.update({
        is_used: true,
        used_at: new Date(),
        used_by_user_id: userId || null,
        used_by_email: userEmail || dto.email || null,
      });

      return {
        success: true,
        message: "Gift card redeemed successfully",
        giftCard: {
          code: giftCard.code,
          amount: giftCard.amount,
          quantity: giftCard.quantity || 1,
        },
        benefits: {
          freeTraveler: giftCard.quantity || 1,
          freeInsurance: giftCard.quantity || 1,
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

