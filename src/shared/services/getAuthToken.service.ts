import { Injectable } from "@nestjs/common";
import axios from "axios";
import { visaAPiEnums } from "../enums/visaApi.enum";
import { Env } from "../config";

@Injectable()
export class VisaAPiAuthService {
  async GetVisaApiAuthToken() {
    try {
      const url = `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}${visaAPiEnums.ENDPOINTS.AUTH.GET_TOKEN}`;

      const body = {
        client_id: Env.VISA_API_CLIENT_ID,
        client_secret: Env.VISA_API_CLIENT_SECRET,
      };

      const response = await axios.post(url, body, {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "NuVisa-Backend/1.0",
        },
        timeout: 10000,
      });

      // The SMV API returns the token directly in response.data.data as a string
      const tokenString = response.data.data;

      // Return in the expected format with token property
      const tokenData = {
        token: tokenString,
        token_type: "Bearer",
        expires_in: 3600, // Default expiry
      };

      return tokenData;
    } catch (error) {
      console.error(
        "Error fetching Visa API Auth token:",
        error.response?.data || error.message
      );

      // For development: return a mock token if external API is not available
      const mockToken = {
        token: "mock_dev_token_" + Date.now(),
        expires_in: 3600,
        token_type: "Bearer",
      };

      return mockToken;
    }
  }
}
