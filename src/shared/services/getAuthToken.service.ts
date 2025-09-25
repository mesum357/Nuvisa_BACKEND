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
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'NuVisa-Backend/1.0',
        },
        timeout: 10000,
      });
      
      // Decode the JWT token to see its contents (for debugging)
      if (response.data.data) {
        try {
          const tokenParts = response.data.data.split('.');
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.log('JWT Token payload:', {
            customer: payload.customer ? {
              _id: payload.customer._id,
              first_name: payload.customer.first_name,
              last_name: payload.customer.last_name,
              roles: payload.customer.roles,
              email: payload.customer.email,
              organisation_id: payload.customer.organisation_id,
              is_smv_user: payload.customer.is_smv_user
            } : 'No customer data',
            iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'No issued at',
            exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'No expiry',
            sub: payload.sub
          });
        } catch {
        }
      }
      
      // The SMV API returns the token directly in response.data.data as a string
      const tokenString = response.data.data;
      
      // Return in the expected format with token property
      const tokenData = {
        token: tokenString,
        token_type: "Bearer",
        expires_in: 3600 // Default expiry
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
        token_type: "Bearer"
      };
      
      return mockToken;
    }
  }
}
