import {
  Controller,
  Post,
  Req,
  Body,
  UsePipes,
  ValidationPipe,
  Get,
} from "@nestjs/common";

import { VisaService } from "./visaApi.service";
import {
  GetObjectTemplateForAPIResponseGeneral,
} from "src/shared/data_templates/ObjectTemplateForAPIResponse";
import { EnumAPIResponseStatusType } from "src/shared/enums";
import axios from 'axios';
import { Env } from '../shared/config';

@Controller("visa")
export class VisaController {
  constructor(private readonly authService: VisaService) {}

  @Get("auth/token")
  async generateToken(): Promise<any> {
    try {
      const result = await this.authService.generateToken();
      return GetObjectTemplateForAPIResponseGeneral(
        result,
        EnumAPIResponseStatusType.SUCCESS,
        "Auth token generated successfully"
      );
    } catch (error) {
      return GetObjectTemplateForAPIResponseGeneral(
        null,
        EnumAPIResponseStatusType.ERROR,
        error.message
      );
    }
  }

  @Get("types")
  async getVisaTypes(@Req() req: any): Promise<any> {
    try {
      const { country } = req.query;
      const result = await this.authService.getVisaTypes(country);
      return GetObjectTemplateForAPIResponseGeneral(
        result,
        EnumAPIResponseStatusType.SUCCESS,
        "Visa types fetched successfully"
      );
    } catch (error) {
      return GetObjectTemplateForAPIResponseGeneral(
        null,
        EnumAPIResponseStatusType.ERROR,
        error.message
      );
    }
  }

  @Get("countries")
  async getCountries(): Promise<any> {
    try {
      const result = await this.authService.getCountries();
      return GetObjectTemplateForAPIResponseGeneral(
        result,
        EnumAPIResponseStatusType.SUCCESS,
        "Countries fetched successfully"
      );
    } catch (error) {
      return GetObjectTemplateForAPIResponseGeneral(
        null,
        EnumAPIResponseStatusType.ERROR,
        error.message
      );
    }
  }

  @Post("order")
  @UsePipes(ValidationPipe)
  async createOrder(@Body() orderData: any): Promise<any> {
    try {
      const result = await this.authService.createOrder(orderData);
      return GetObjectTemplateForAPIResponseGeneral(
        result,
        EnumAPIResponseStatusType.SUCCESS,
        "Order created successfully"
      );
    } catch (error) {
      return GetObjectTemplateForAPIResponseGeneral(
        null,
        EnumAPIResponseStatusType.ERROR,
        error.message
      );
    }
  }

  @Get("debug/smv-auth")
  async debugSmvAuth() {
    try {
      console.log('\n=== DEBUG: Testing SMV API Authentication ===');
      
      // Get auth token using the existing service 
      const tokenResponse = await this.authService.generateToken();
      
      // The token might be nested in response object
      const authToken = tokenResponse.token || tokenResponse.response?.token;
      
      if (!authToken) {
        return {
          success: false,
          error: 'No auth token received',
          tokenResponse
        };
      }

      console.log('\n=== Testing Different SMV API Endpoints ===');
      const endpoints = [
        '/countries',
        '/visa_types',
        '/visa_types?symbol=ESP',
        '/visa_types?symbol=USA',
      ];

      const results = {};

      for (const endpoint of endpoints) {
        try {
          console.log(`\nTesting endpoint: ${endpoint}`);
          const url = `${Env.VISA_API_SERVER}/${Env.VISA_API_VERSION}${endpoint}`;
          
          const response = await axios.get(url, {
            headers: {
              'Authorization': authToken, // Try without "Bearer " prefix
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

          console.log(`Result for ${endpoint}:`, {
            status: response.status,
            success: response.status === 200,
            dataType: typeof response.data
          });

        } catch (error) {
          results[endpoint] = {
            status: error.response?.status || 'ERROR',
            success: false,
            error: error.message,
            data: error.response?.data
          };

          console.log(`Error for ${endpoint}:`, {
            status: error.response?.status,
            message: error.message
          });
        }
      }

      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.SUCCESS,
        {
          authToken: {
            hasToken: !!authToken,
            tokenLength: authToken.length,
            tokenPrefix: authToken.substring(0, 50) + '...',
          },
          endpointTests: results,
          apiServer: Env.VISA_API_SERVER,
          apiVersion: Env.VISA_API_VERSION
        },
        "SMV API debug completed"
      );

    } catch (error) {
      return GetObjectTemplateForAPIResponseGeneral(
        EnumAPIResponseStatusType.ERROR,
        { error: error.message },
        "Debug failed"
      );
    }
  }
}

// 1 website for payment and home page - your current - Laravel

// Laravel application, what APis are present there right now,
// Stripe

// Where are our user APis ?  applications, Payment information

// 2nd website would be dashboard - what i am building - Next

// User login

// We need a backend, that will handle applications per userInfo, users login

// Order on stampmyvisa -> we will associate user data with it

// when i fetch orders or submitted applications from stampmyvisa they will provide me with user data associated with application and we will show that on our dashboard

// ------------------------------------------------

// we will be having a separate backend

// User loign APis

// Our Database

// Users <- our customers
// Applications <- that will store visa applications

// user will come LoginDto, or checkout

// we will get user information at login or checkout -> store this information in our database

// when a user apply for visa ->

// we will capture loggedin user details -> submit visa application to stampmyvisa for user ->

// we will store this visa application in our database with logged in user id associated

// application table -> 1 application

// Application 1 : {
//     ...application data,
//     user id, user email
// }

// once user will login ->>

// on our frontend -> submitted applications are showing ->

// we will get logged in user details again -> we will get user id and user email

// we will query our database to give us the records or applications that have the above user id, and above user email

// ----

// we can have a separate dashboard for admin -> for you

// where we will show all the applications -> for all the users
// we can show all the payments that are processed till now -> which payment is made by which user

// which visa application is for which user

// how many users I have on my website

// from all users how many users are active -> user 1 made 5 visa applications, user 2 made 3 visa applications

// user will login

// create new application -> checkout -> user paid -> get back to dashboard -> we will show just paid country fee in new application tab -> start application -> fill in data -> submit -> this application in submitted applications -> button -> status -> in review | pending

// New user ->

// home page -> select country -> go to checkout -> make payment -> redirected to dashboard with the same email he filled during checkout

// I created a separate backend

// our home page -> navbar says login if the user is not logged in yet or didn't made a payment
// if the user is logged in navbar will say -> my applications

// backned, payments, APis, datababe, frontend

// user paid for the insurance during checkout

// insurance option should not be there in application stpes

// if the userd didn't paid it during checkout , we will show insurance option in application steps
