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
      const tokenResponse = await this.visaApiAuthService.GetVisaApiAuthToken();
      // Extract the token - now we know it's always in the token property
      const authToken = tokenResponse?.token;
      if (!authToken) {
        console.error(
          "No auth token received from service - tokenResponse:",
          tokenResponse
        );
        return this.getMockVisaTypes(countryCode);
      }

      // Check if using mock token
      if (authToken.startsWith("mock_dev_token_")) {
        return this.getMockVisaTypes(countryCode);
      }

      // First try to test a basic endpoint to verify our authentication works
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
      } catch {
      }

      // Build URL for visa types API (include API version)
      let url = `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}/visa_types`;
      if (countryCode) {
        url += `?symbol=${countryCode}`;
      }

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
          const baseUrl = `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}/visa_types`;

          // Get fresh auth token for retry
          const tokenResponse =
            await this.visaApiAuthService.GetVisaApiAuthToken();
          const authToken = tokenResponse.token;

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
