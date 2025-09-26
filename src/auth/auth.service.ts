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
} from "src/shared/services/sendEmail.service";
import { UpdateUserDto, VefifyOtpDto } from "./dto/auth.dto";
import { Op } from "sequelize";

import { Env } from "src/shared/config";

//auth
@Injectable()
export class AuthService {
  constructor(private readonly jwtAuthService: JwtAuthService) {}

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

  async login(loginDto: LoginDto): Promise<any> {
    try {
      const { email, sessionUser } = loginDto;

      let user = await this.checkIfUserExists(email);

      if (!user) {
        const username = `user_${uuidv4().replace(/-/g, "").substr(0, 8)}`;
        user = await User.create({
          email,
          user_name: username,
          first_name: "",
          last_name: "",
          phone_no: "",
        });
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
      const { email, firstName, lastName, DOB, phoneNo } = updateUserDto;

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

      const { subject, emailBody } = renderTemplate(emailType, dynamicData);
      const sendingEmail = await sendEmail({
        emailAddress: dynamicData.email,
        subject,
        body: emailBody,
      });
      console.log(
        sendingEmail,
        JSON.stringify(sendingEmail),
        "TEMP__________EMAIL"
      );
    } catch (err) {
      callHTTPException("Something went wrong while sending welcome email");
    }
  }
}
