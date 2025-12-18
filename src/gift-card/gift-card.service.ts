import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
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
  }): Promise<GiftCard> {
    try {
      const quantity = data.quantity || 1;
      
      console.log('🎁 Creating Gift Card:');
      console.log('   📧 Email:', data.email);
      console.log('   💰 Amount:', data.amount);
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
          amount: data.amount,
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

      // Send email with all codes
      await this.sendGiftCardEmail(giftCards);

      // Return the first gift card for backward compatibility
      return giftCards[0];
    } catch (error) {
      console.error("Error creating gift card:", error);
      callHTTPException(`Failed to create gift card: ${error.message}`);
    }
  }

  /**
   * Send gift card email with redemption code(s)
   */
  private async sendGiftCardEmail(giftCards: GiftCard[]): Promise<void> {
    // Handle both single gift card and array for backward compatibility
    const giftCardsArray = Array.isArray(giftCards) ? giftCards : [giftCards];
    const firstCard = giftCardsArray[0];
    
    try {
      
      console.log('📧 Sending Gift Card Email:');
      console.log('   📧 To:', firstCard.email);
      console.log('   🎫 Number of Codes:', giftCardsArray.length);
      console.log('   🎫 Codes:', giftCardsArray.map(gc => gc.code).join(', '));
      console.log('   💰 Amount:', firstCard.amount);
      
      // Get email template from database
      const template = await EmailTemplate.findOne({
        where: { key: "gift_card_purchase", isActive: true },
      });

      if (!template) {
        console.error("❌ Gift card email template not found");
        // Don't throw error, just log - email will be sent via Stripe receipt
        return;
      }

      // Prepare codes data - send all codes to the email template
      const codes = giftCardsArray.map(gc => gc.code);
      const dynamicData = {
        code: codes[0], // Primary code for backward compatibility
        codes: codes, // All codes as an array
        amount: firstCard.amount,
        quantity: giftCardsArray.length,
        email: firstCard.email,
      };

      const { subject, emailBody } = await renderTemplateFromDB(
        "gift_card_purchase",
        dynamicData,
        template
      );

      // Ensure gift card artwork is embedded inline so email clients don't block it
      const giftCardImageCid = "gift-card-image";
      
      // Generate multiple gift card images (one for each code)
      const giftCardImagesHtml = codes.map((code, index) => 
        `<div style="text-align: center; margin: 24px 0 12px 0;">
          <img src="cid:${giftCardImageCid}" alt="NUvisa gift card ${index + 1} of ${codes.length}" style="max-width: 100%; height: auto; border-radius: 12px; display: inline-block; box-shadow: 0 8px 20px rgba(0,0,0,0.08);">
        </div>`
      ).join('');

      let finalEmailBody = emailBody;
      
      // Update the redemption text based on number of travellers
      const travellerText = codes.length === 1 
        ? `Your gift card redemption code for 1 traveller is:` 
        : `Your gift card redemption codes for ${codes.length} travellers are:`;
      
      // Replace the redemption text in the email
      finalEmailBody = finalEmailBody.replace(
        /Your gift card redemption code is:/i,
        travellerText
      );
      
      // Replace single code with all codes if multiple gift cards
      if (codes.length > 1) {
        // Generate HTML for all codes (without "Gift Card X of Y" text)
        const allCodesHtml = codes.map((code) => 
          `<div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 12px 0; text-align: center;">
            <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 2px; color: #000; font-family: 'Courier New', monospace;">${code}</p>
          </div>`
        ).join('');
        
        // Find and replace the single code block with all codes
        const singleCodeRegex = new RegExp(`<p[^>]*style="[^"]*font-size:\\s*32px[^"]*"[^>]*>${codes[0]}<\\/p>`, 'i');
        if (singleCodeRegex.test(finalEmailBody)) {
          finalEmailBody = finalEmailBody.replace(singleCodeRegex, allCodesHtml);
        } else {
          // Fallback: try to find the code anywhere in the body
          const codeOnlyRegex = new RegExp(codes[0], 'g');
          const firstOccurrence = finalEmailBody.indexOf(codes[0]);
          if (firstOccurrence !== -1) {
            // Replace first occurrence with all codes
            finalEmailBody = finalEmailBody.substring(0, firstOccurrence) + 
                           allCodesHtml + 
                           finalEmailBody.substring(firstOccurrence + codes[0].length);
          }
        }
      }
      
      if (!finalEmailBody.includes(giftCardImageCid)) {
        // Insert the images right after the code block(s)
        const codeBlockRegex = /<div[^>]*style="[^"]*background:\s*#f5f5f5[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
        const codeBlocks = finalEmailBody.match(codeBlockRegex);
        
        if (codeBlocks && codeBlocks.length > 0) {
          // Find the position after the last code block
          const lastCodeBlock = codeBlocks[codeBlocks.length - 1];
          const lastCodeBlockIndex = finalEmailBody.lastIndexOf(lastCodeBlock);
          const insertPosition = lastCodeBlockIndex + lastCodeBlock.length;
          
          // Insert all images after the last code block
          finalEmailBody = finalEmailBody.substring(0, insertPosition) + 
                          giftCardImagesHtml + 
                          finalEmailBody.substring(insertPosition);
        } else {
          // Fallback: try to find single code in paragraph tag
          const singleCodeRegex = /<p[^>]*style="[^"]*font-size:\s*32px[^"]*"[^>]*>.*?<\/p>/i;
          const match = finalEmailBody.match(singleCodeRegex);
          
          if (match) {
            const codePosition = finalEmailBody.indexOf(match[0]);
            const insertPosition = codePosition + match[0].length;
            finalEmailBody = finalEmailBody.substring(0, insertPosition) + 
                           giftCardImagesHtml + 
                           finalEmailBody.substring(insertPosition);
          } else {
            // Last resort: append near the top
            finalEmailBody = `${giftCardImagesHtml}${finalEmailBody}`;
          }
        }
      }

      // Get footer content
      const footerContent = await this.getEmailFooterContent();

      // Send email
      await sendEmail(
        {
          emailAddress: firstCard.email,
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
        footerContent
      );
      
      console.log('   ✅ Gift card email sent successfully');
    } catch (error) {
      console.error("❌ Error sending gift card email:", error);
      console.error("📧 Gift card email details:", {
        recipient: firstCard.email,
        codes: giftCardsArray.map(gc => gc.code),
        quantity: giftCardsArray.length,
        amount: firstCard.amount,
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

