import { Controller, Get, Query } from '@nestjs/common';
import { VisaAPiAuthService } from '../shared/services/getAuthToken.service';
import axios from 'axios';
import { Env } from '../shared/config';

@Controller('debug')
export class DebugController {
  constructor(private readonly visaApiAuthService: VisaAPiAuthService) {}

  @Get('smv-auth')
  async debugSmvAuth() {
    try {
      
      // Get auth token
      const tokenResponse = await this.visaApiAuthService.GetVisaApiAuthToken();
      const authToken = tokenResponse.token;

      if (!authToken) {
        return {
          success: false,
          error: 'No auth token received',
          tokenResponse
        };
      }

      const endpoints = [
        '/countries',
        '/visa_types',
        '/visa_types?symbol=ESP',
        '/visa_types?symbol=USA',
      ];

      const results = {};

      for (const endpoint of endpoints) {
        try {
          const url = `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}${endpoint}`;
          
          const response = await axios.get(url, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': 'NuVisa-Debug/1.0',
            },
            timeout: 5000,
            validateStatus: function (status) {
              return status < 500; // Don't throw for 4xx errors
            }
          });

          results[endpoint] = {
            status: response.status,
            statusText: response.statusText,
            success: response.status === 200,
            dataType: typeof response.data,
            headers: {
              'content-type': response.headers['content-type'],
              'server': response.headers['server'],
            },
            data: response.status === 200 ? response.data : response.data
          };
        } catch (error) {
          results[endpoint] = {
            status: error.response?.status || 'ERROR',
            success: false,
            error: error.message,
            data: error.response?.data
          };
        }
      }

      return {
        success: true,
        authToken: {
          hasToken: !!authToken,
          tokenLength: authToken.length,
          tokenPrefix: authToken.substring(0, 50) + '...',
        },
        endpointTests: results,
        apiServer: Env.VISA_API_SERVER,
        apiVersion: Env.VISA_API_VERSION
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  @Get('token-decode')
  async debugTokenDecode() {
    try {
      const tokenResponse = await this.visaApiAuthService.GetVisaApiAuthToken();
      const authToken = tokenResponse.token;

      if (!authToken || authToken.startsWith('mock_')) {
        return {
          success: false,
          error: 'No real token available - using mock token',
          tokenResponse
        };
      }

      // Decode JWT token
      const tokenParts = authToken.split('.');
      const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());

      return {
        success: true,
        token: {
          header,
          payload: {
            ...payload,
            iat_readable: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
            exp_readable: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
            time_until_expiry: payload.exp ? Math.floor((payload.exp * 1000 - Date.now()) / 1000) + ' seconds' : null
          }
        },
        tokenLength: authToken.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
