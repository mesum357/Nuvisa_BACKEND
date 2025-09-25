import { Injectable } from "@nestjs/common";


import { Env } from "src/shared/config";
import { VisaAPiAuthService } from "src/shared/services/getAuthToken.service";
import axios from "axios";

//auth
@Injectable()
export class VisaService {
  constructor(private readonly visaApiAuthService: VisaAPiAuthService) {}

  async generateToken(): Promise<any> {
    const response = await this.visaApiAuthService.GetVisaApiAuthToken();
    return { response };
  }

  async getVisaTypes(countryCode?: string): Promise<any> {
    try {
      // Get auth token first
      console.log("Attempting to get visa types for country:", countryCode);
      const tokenResponse = await this.visaApiAuthService.GetVisaApiAuthToken();
      console.log("Token response received:", {
        fullResponse: tokenResponse,
        hasToken: !!tokenResponse?.token,
        tokenType: tokenResponse?.token_type,
        tokenPrefix: tokenResponse?.token?.substring(0, 20) + "...",
      });

      // Extract the token - now we know it's always in the token property
      const authToken = tokenResponse?.token;

      console.log("Extracted auth token:", {
        token: authToken ? authToken.substring(0, 20) + "..." : "null",
        tokenExists: !!authToken,
      });

      if (!authToken) {
        console.error(
          "No auth token received from service - tokenResponse:",
          tokenResponse
        );
        console.log("Falling back to mock data due to missing token");
        return this.getMockVisaTypes(countryCode);
      }

      // Check if using mock token
      if (authToken.startsWith("mock_dev_token_")) {
        console.log("Using mock visa types data for development");
        return this.getMockVisaTypes(countryCode);
      }

      console.log("Using real SMV API with auth token");

      // First try to test a basic endpoint to verify our authentication works
      console.log(
        "Testing SMV API authentication with a basic endpoint first..."
      );

      try {
        const testResponse = await axios.get(
          `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}/countries`,
          {
            headers: {
              Authorization: authToken, // Try without "Bearer " prefix
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "NuVisa-Backend/1.0",
              "X-Requested-With": "XMLHttpRequest",
            },
            timeout: 5000,
            validateStatus: function (status) {
              return status < 500; // Don't throw for 4xx errors
            },
          }
        );

        if (testResponse.status === 200) {
          console.log("SMV API authentication test successful:", {
            status: testResponse.status,
            endpoint: "countries",
            dataType: typeof testResponse.data,
          });
        } else {
          console.log("SMV API countries endpoint returned non-200 status:", {
            status: testResponse.status,
            statusText: testResponse.statusText,
            data: testResponse.data,
          });
        }
      } catch (testError) {
        console.log(
          "SMV API authentication test failed on countries endpoint:",
          {
            status: testError.response?.status,
            statusText: testError.response?.statusText,
            data: testError.response?.data,
            message: testError.message,
          }
        );
      }

      // Build URL for visa types API (include API version)
      let url = `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}/visa_types`;
      if (countryCode) {
        url += `?symbol=${countryCode}`;
      }

      console.log("Making request to SMV API visa_types:", {
        url: url,
        method: "GET",
        hasAuthToken: !!authToken,
        countryCode: countryCode,
        tokenPrefix: authToken.substring(0, 50) + "...",
      });

      const response = await axios.get(url, {
        headers: {
          Authorization: authToken, // Try without "Bearer " prefix
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "NuVisa-Backend/1.0",
          "X-Requested-With": "XMLHttpRequest",
        },
        timeout: 10000, // 10 second timeout
        validateStatus: function (status) {
          return status < 500; // Don't throw for 4xx errors, we want to see them
        },
      });

      console.log("SMV API visa_types response:", {
        status: response.status,
        statusText: response.statusText,
        headers: {
          "content-type": response.headers["content-type"],
          server: response.headers["server"],
          date: response.headers["date"],
        },
        dataType: typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : "N/A",
      });

      if (response.status === 401) {
        console.error(
          "401 Unauthorized received from SMV API visa_types endpoint"
        );
        console.error(
          "This suggests the token is invalid or lacks permissions for this endpoint"
        );
        throw new Error(
          `SMV API returned 401: ${JSON.stringify(response.data)}`
        );
      }

      if (response.status >= 400) {
        console.error(
          `SMV API returned error status ${response.status}:`,
          response.data
        );
        throw new Error(
          `SMV API returned ${response.status}: ${JSON.stringify(response.data)}`
        );
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error("Error in getVisaTypes:", error.message);
      console.error("Error response status:", error.response?.status);
      console.error("Error response data:", error.response?.data);
      console.error("Error response headers:", error.response?.headers);
      console.error("Request config:", {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
      });

      // If we get 401 error and we're using a country code, try without it
      if (error.response?.status === 401 && countryCode) {
        try {
          console.log("Retrying without country code due to 401 error...");
          const baseUrl = `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}/visa_types`;

          // Get fresh auth token for retry
          const tokenResponse =
            await this.visaApiAuthService.GetVisaApiAuthToken();
          const authToken = tokenResponse.token;

          console.log("Retrying with fresh token:", {
            hasToken: !!authToken,
            tokenLength: authToken?.length,
            tokenPrefix: authToken?.substring(0, 30) + "...",
          });

          const retryResponse = await axios.get(baseUrl, {
            headers: {
              Authorization: authToken, // Try without "Bearer " prefix
              Accept: "application/json",
              "Content-Type": "application/json",
              "User-Agent": "NuVisa-Backend/1.0",
              "X-Requested-With": "XMLHttpRequest",
            },
            timeout: 10000,
            validateStatus: function (status) {
              return status < 500; // Don't throw for 4xx errors
            },
          });

          console.log("Retry without country code succeeded:", {
            status: retryResponse.status,
            dataLength: Array.isArray(retryResponse.data)
              ? retryResponse.data.length
              : "N/A",
          });

          return {
            success: true,
            data: retryResponse.data,
          };
        } catch (retryError) {
          console.error("Retry also failed:", {
            status: retryError.response?.status,
            data: retryError.response?.data,
            message: retryError.message,
          });
        }
      }

      // If there's an error, try to fallback to mock data
      console.log("Fallback: Using mock visa types data due to error");
      console.log(
        "Note: SMV API returned 401 Authentication failed. This suggests:"
      );
      console.log(
        "1. API credentials may not have permission to access visa_types endpoint"
      );
      console.log(
        "2. visa_types endpoint may require additional authorization"
      );
      console.log("3. Contact SMV API team to verify endpoint permissions");

      const mockData = this.getMockVisaTypes(countryCode);
      return {
        success: true,
        data: mockData,
        source: "mock", // Indicate this is mock data
        error: error.message,
        apiIssue: "SMV API visa_types endpoint returned 401 - using mock data",
      };
    }
  }

  async getCountries(): Promise<any> {
    try {
      // Get auth token first
      const tokenResponse = await this.visaApiAuthService.GetVisaApiAuthToken();
      const authToken = tokenResponse.token;

      if (!authToken) {
        throw new Error("Failed to get authentication token");
      }

      // Check if using mock token
      if (authToken.startsWith("mock_dev_token_")) {
        console.log("Using mock countries data for development");
        return this.getMockCountries();
      }

      const response = await axios.get(
        `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}/countries?page_no=1&page_size=50`,
        {
          headers: {
            Authorization: authToken, // Remove "Bearer " prefix
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error("Error fetching countries:", error);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  async createOrder(orderData: {
    visa_type_id: string;
    travel_start_date: string;
    travel_end_date: string;
    no_of_travelers: number;
  }): Promise<any> {
    try {
      // Get auth token first
      const tokenResponse = await this.visaApiAuthService.GetVisaApiAuthToken();
      const authToken = tokenResponse.token;

      if (!authToken) {
        throw new Error("Failed to get authentication token");
      }

    

      // Use the exact SMV Konveyor API format
      const payload = {
        visa_type_id: orderData.visa_type_id,
        travel_start_date: orderData.travel_start_date,
        travel_end_date: orderData.travel_end_date,
        no_of_travelers: orderData.no_of_travelers,
      };

      const response = await axios.post(
        `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}/orders`,
        payload,
        {
          headers: {
            Authorization: authToken,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error("Error creating order:", error);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }

  private getMockVisaTypes(countryCode?: string): any {
    // Mock visa types data for development
    const mockVisaTypes = [
      {
        id: "mock_tourist_visa",
        name: "Tourist Visa",
        description: "For tourism and leisure travel",
        processing_time: "5-10 working days",
        validity: "90 days",
        price: 80,
        currency: "EUR",
        requirements: [
          "Valid passport",
          "Travel insurance",
          "Proof of accommodation",
          "Return ticket",
        ],
      },
      {
        id: "mock_business_visa",
        name: "Business Visa",
        description: "For business meetings and conferences",
        processing_time: "3-7 working days",
        validity: "90 days",
        price: 120,
        currency: "EUR",
        requirements: [
          "Valid passport",
          "Business invitation",
          "Travel insurance",
          "Company registration",
        ],
      },
      {
        id: "mock_transit_visa",
        name: "Transit Visa",
        description: "For transit through the country",
        processing_time: "2-5 working days",
        validity: "15 days",
        price: 35,
        currency: "EUR",
        requirements: [
          "Valid passport",
          "Onward ticket",
          "Valid visa for final destination",
        ],
      },
    ];

    return {
      success: true,
      data: mockVisaTypes,
      total: mockVisaTypes.length,
      country: countryCode || "Unknown",
    };
  }

  private getMockCountries(): any {
    // Mock countries data for development
    const mockCountries = [
      { code: "DE", name: "Germany", flag: "🇩🇪" },
      { code: "FR", name: "France", flag: "🇫🇷" },
      { code: "IT", name: "Italy", flag: "🇮🇹" },
      { code: "ES", name: "Spain", flag: "🇪🇸" },
      { code: "NL", name: "Netherlands", flag: "🇳🇱" },
      { code: "AT", name: "Austria", flag: "🇦🇹" },
      { code: "BE", name: "Belgium", flag: "🇧🇪" },
      { code: "CH", name: "Switzerland", flag: "🇨🇭" },
    ];

    return {
      success: true,
      data: mockCountries,
      total: mockCountries.length,
    };
  }

  private getMockOrderCreation(orderData: any): any {
    // Mock order creation for development - matching SMV Konveyor API response format
    const mockOrder = {
      order_id: "mock_order_" + Date.now(),
      visa_type_id: orderData.visa_type_id,
      status: "pending",
      travel_start_date: orderData.travel_start_date,
      travel_end_date: orderData.travel_end_date,
      no_of_travelers: orderData.no_of_travelers,
      created_at: new Date().toISOString(),
      estimated_processing_time: "5-10 business days",
    };

    return {
      success: true,
      data: mockOrder,
      message: "Order created successfully (mock)",
    };
  }
}
