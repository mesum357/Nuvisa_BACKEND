import { User } from "./auth.entity";
import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { LoginDto, UserDto } from "./dto";
import * as bcrypt from "bcrypt";
import { JwtAuthService } from "src/shared/services/jwt-auth.service";
import { v4 } from "uuid";
import { callHTTPException } from "src/shared/exceptions";

import {
  sendEmail,
  renderTemplate,
  renderTemplateFromDB,
} from "src/shared/services/sendEmail.service";
import { EmailTemplate } from "src/email-templates/email-template.entity";
import { UpdateUserDto, VefifyOtpDto } from "./dto/auth.dto";
import { Op } from "sequelize";
import { Sequelize } from "sequelize-typescript";

import { Env } from "src/shared/config";

//auth
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtAuthService: JwtAuthService,
    private readonly sequelize: Sequelize
  ) { }

  async checkIfUserExists(email: string): Promise<User> {
    const user = await User.findOne({
      where: { email },
    });
    return user;
  }

  async registerUser(userDto: UserDto): Promise<any> {
    try {
      const username = `user_${uuidv4().replace(/-/g, "").substr(0, 8)}`;

      const token = v4();

      const phoneNo = userDto.phoneNo;

      const user = await User.create({
        first_name: userDto.firstName,
        last_name: userDto.lastName,
        user_name: username,
        email: userDto.email,
        phone_no: phoneNo,
      });

      const Token = await this.jwtAuthService.generateToken(user.dataValues);
      return { user, token: Token };
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  async login(loginDto: LoginDto, type = null): Promise<any> {
    try {
      const { email, sessionUser } = loginDto;

      let user = await this.checkIfUserExists(email);

      if (!user) {
        if (type === "checkout") {
          const guestUsername = `user_${v4().replace(/-/g, "").substr(0, 8)}`;
          user = await User.create({
            first_name: "",
            last_name: "",
            user_name: guestUsername,
            email: email,
            phone_no: null,
          });
        } else {
          throw callHTTPException(
            "Account dosn’t exist, you may checkout instead."
          );
        }
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Save OTP & expiry
      user.otp = otp;
      user.otp_expiry = new Date(Date.now() + 5 * 60 * 1000); // expires in 5 min

      await user.save();

      if (sessionUser) {
        const otpBody = {
          email: email,
          otp: otp,
        };
        return await this.verifyOtp(otpBody);
      } else {
        await this.sendOtpEmail(email, otp, "otp_email");
      }

      return { message: "OTP sent successfully" };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async verifyOtp(verifyOtpDto: VefifyOtpDto): Promise<any> {
    try {
      const { email, otp } = verifyOtpDto;
      // 1. Find user
      const user = await this.checkIfUserExists(email);
      if (!user) {
        callHTTPException("User with this email does not exist");
      }

      // 2. Check OTP
      if (!user.otp || user.otp !== otp) {
        callHTTPException("Invalid OTP");
      }

      // 3. (Optional) If you have otp_expiry, validate it
      // if (user.otp_expiry && new Date() > user.otp_expiry) {
      //   callHTTPException("OTP expired");
      // }

      // 4. OTP is valid — clear it
      // user.otp = null;

      // await user.save();

      // 5. Generate JWT token
      const token = await this.jwtAuthService.generateToken(user.dataValues);

      return {
        message: "OTP verified successfully",
        token,
        user,
      };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async getAllUsers(keyword: string): Promise<any> {
    try {
      let users;
      if (keyword && keyword.trim() !== "") {
        // Filter users based on the keyword
        users = await User.findAll({
          where: {
            [Op.or]: [
              {
                first_name: {
                  [Op.iLike]: `%${keyword}%`,
                },
              },
              {
                last_name: {
                  [Op.iLike]: `%${keyword}%`,
                },
              },
              {
                email: {
                  [Op.iLike]: `%${keyword}%`,
                },
              },
              {
                user_name: {
                  [Op.iLike]: `%${keyword}%`,
                },
              },
            ],
          },
          order: [["createdAt", "DESC"]],
        });
      } else {
        // If no keyword provided, get all users
        users = await User.findAll({
          order: [["createdAt", "DESC"]],
        });
      }

      // If no users found, return an empty array or null
      if (!users || users.length === 0) {
        return null; // or return an empty array, depending on your preference
      }
      return users;
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async updateUser(files: any, updateUserDto: UpdateUserDto): Promise<any> {
    try {
      const { email, firstName, lastName, DOB: _DOB, phoneNo } = updateUserDto;

      const user = await this.checkIfUserExists(email);
      if (!user) {
        callHTTPException("User with this email does not exist");
      }

      if (firstName) user.first_name = firstName;
      if (lastName) user.last_name = lastName;

      if (phoneNo) user.phone_no = phoneNo;

      await user.save();
      const responseObject = {
        id: user.id,
        user_name: user.user_name,
        first_name: user.first_name,

        last_name: user.last_name,

        email: user.email,
        phone_no: user.phone_no,
      };
      return responseObject;
    } catch (error) {
      callHTTPException(error.message);
    }
  }

  async sendOtpEmail(
    email: string,
    otp: string,
    emailType: string
  ): Promise<void> {
    try {
      const dynamicData = {
        email,
        otp,
      };

      // Try to use database template first
      try {
        const template = await EmailTemplate.findOne({
          where: { key: emailType, isActive: true }
        });

        if (template) {
          const { subject, emailBody } = await renderTemplateFromDB(
            emailType,
            dynamicData,
            template
          );
          
          const footerContent = await this.getEmailFooterContent();
          
          await sendEmail(
            {
              emailAddress: dynamicData.email,
              subject,
              body: emailBody,
              excludeDecorativeImage: true,
            },
            footerContent
          );
        } else {
          // Fallback to static templates
          const { subject, emailBody } = await renderTemplate(emailType, dynamicData);
          const footerContent = await this.getEmailFooterContent();
          await sendEmail(
            {
              emailAddress: dynamicData.email,
              subject,
              body: emailBody,
              excludeDecorativeImage: true,
            },
            footerContent
          );
        }
      } catch (templateError) {
        // Fallback to static templates
        const { subject, emailBody } = await renderTemplate(emailType, dynamicData);
        const footerContent = await this.getEmailFooterContent();
        await sendEmail(
          {
            emailAddress: dynamicData.email,
            subject,
            body: emailBody,
            excludeDecorativeImage: true,
          },
          footerContent
        );
      }
    } catch {
      callHTTPException("Something went wrong while sending welcome email");
    }
  }

  /**
   * Get email footer content (logo, social links, etc.)
   */
  private async getEmailFooterContent(): Promise<any> {
    try {
      // Try to query site_content table for logo URL and social links
      let logoUrl = '';
      let twitter = '#';
      let facebook = '#';
      let instagram = '#';
      let linkedin = '#';
      let teamSignature = '— Team NUvisa';
      let companyInfo: string[] = [];
      
      try {
        // Try to get from backend database first
        const logoContent = await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = 'email_logo_url' LIMIT 1
        `) as any[];
        logoUrl = logoContent?.[0]?.[0]?.value || '';
        
        // If not found, check common paths
        if (!logoUrl) {
          // Try common logo paths as fallback (public logo on live frontend)
          logoUrl = '/image/logo.png';
        }
        
        const socialLinks = await this.sequelize.query(`
          SELECT key, value FROM site_content WHERE key IN ('social_twitter', 'social_facebook', 'social_instagram', 'social_linkedin')
        `) as any[];
        
        socialLinks.forEach((link: any) => {
          const row = Array.isArray(link) ? link[0] : link;
          const key = row?.key?.replace('social_', '') || '';
          const value = row?.value || '';
          if (key === 'twitter') twitter = value || '#';
          if (key === 'facebook') facebook = value || '#';
          if (key === 'instagram') instagram = value || '#';
          if (key === 'linkedin') linkedin = value || '#';
        });

        // Get team signature and company info
        const teamSignatureResult = await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = 'email_team_signature' LIMIT 1
        `) as any[];
        teamSignature = teamSignatureResult?.[0]?.[0]?.value || '— Team NUvisa';

        const companyInfoResult = await this.sequelize.query(`
          SELECT value FROM site_content WHERE key = 'email_company_info' LIMIT 1
        `) as any[];
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
        // site_content table might not exist in backend database
        logoUrl = '';
      }

      // Global fallback if DB lookup failed entirely
      if (!logoUrl) {
        logoUrl = '/image/logo.png';
      }

      const baseUrl = Env.WEBSITE_URL || 'https://nuvisa.co.uk';
      const helpCentreUrl = `${baseUrl}/get-the-visa#faq`;
      
      // Use company info from database or fallback
      if (companyInfo.length === 0) {
        companyInfo = [
          `If you have any questions, please visit our <a href="${helpCentreUrl}" style="color: #000000; text-decoration: underline;">Help Centre</a>.`
        ];
      }
      
      const footerContent = {
        logo: logoUrl,
        twitter,
        facebook,
        instagram,
        linkedin,
        teamSignature: teamSignature || '— Team NUvisa',
        companyInfo
      };

      return footerContent;
    } catch (error) {
      return {
        logo: '',
        twitter: '#',
        facebook: '#',
        instagram: '#',
        linkedin: '#',
        companyInfo: []
      };
    }
  }
}
