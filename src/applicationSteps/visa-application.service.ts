import { Injectable } from "@nestjs/common";
import { VisaApplication } from "./visa-application.entity";
// import { VisaApplicationDto, VisaApplicationStepType } from "./dto/visa-application.dto";
import { callHTTPException } from "src/shared/exceptions";
import {
  GetApplicationByIdDto,
  VisaApplicationDeleteDto,
  VisaApplicationDto,
  VisaApplicationStepType,
} from "./dto/visa-application.dto";
import { User } from "src/auth/auth.entity";

// Utility function to filter sensitive data from traveler objects for logging
function filterSensitiveDataForLogging(data: any): any {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => filterSensitiveDataForLogging(item));
  }

  if (typeof data === "object") {
    const filtered = { ...data };

    // Remove passport image fields
    if (filtered.passportFront) {
      filtered.passportFront = "[BASE64_IMAGE_DATA_REMOVED]";
    }
    if (filtered.passportBack) {
      filtered.passportBack = "[BASE64_IMAGE_DATA_REMOVED]";
    }
    if (filtered.insuranceCertificate) {
      filtered.insuranceCertificate = "[BASE64_IMAGE_DATA_REMOVED]";
    }

    // Remove document image fields
    if (filtered.documents && typeof filtered.documents === "object") {
      Object.keys(filtered.documents).forEach((docKey) => {
        if (
          typeof filtered.documents[docKey] === "string" &&
          filtered.documents[docKey].startsWith("data:")
        ) {
          filtered.documents[docKey] = "[BASE64_IMAGE_DATA_REMOVED]";
        }
      });
    }

    // Recursively filter nested objects
    Object.keys(filtered).forEach((key) => {
      if (typeof filtered[key] === "object" && filtered[key] !== null) {
        filtered[key] = filterSensitiveDataForLogging(filtered[key]);
      }
    });

    return filtered;
  }

  return data;
}

@Injectable()
export class VisaApplicationService {
  async checkIfUserExists(id): Promise<User> {
    const user = await User.findByPk(id);
    return user;
  }

  async getUserVisaApplications(userId) {
    try {
      const user = await this.checkIfUserExists(userId);

      console.log("user.email ::: ", user.email);
      const userVisaApplications = await VisaApplication.findAll({
        where: { email: user.email },
      });

      // Parse travelersData for each application and add step info
      const applicationsWithParsedData = userVisaApplications.map((app) => {
        let parsedTravelersData = null;

        // Handle backward compatibility and missing travelersData
        if (app.travelersData) {
          try {
            parsedTravelersData = JSON.parse(app.travelersData);
          } catch (error) {
            console.error(
              "Error parsing travelersData for app",
              app.id,
              ":",
              error
            );
            parsedTravelersData = null;
          }
        }

        // If travelersData is null/missing, initialize it based on numberOfTravellers
        if (!parsedTravelersData && app.numberOfTravellers) {
          console.log(
            `Initializing missing travelersData for application ${app.id}`
          );
          parsedTravelersData = Array.from(
            { length: app.numberOfTravellers },
            (_, index) => ({
              id: index + 1,
              basicDetails: {
                passportNumber: "",
                firstName: "",
                lastName: "",
                sex: "",
                dateOfBirth: "",
                placeOfBirth: "",
                passportIssuePlace: "",
                passportIssueDate: "",
                passportExpiryDate: "",
                currentAddress1: "",
                currentAddress2: "",
                state: "",
                city: "",
                pincode: "",
                mobileNumber: "",
                passportFront: null,
                passportBack: null,
              },
              visitDetails: {
                visitingOtherSchengenCountries: [],
                firstCountryOfEntry: "",
                hasSchengenVisa: "",
                lastVisaStartDate: "",
                lastVisaEndDate: "",
                hasDigitalFingerprints: "",
                previousVisaNumber: "",
                maritalStatus: "",
                partnerFullName: "",
                partnerDateOfBirth: "",
                employmentStatus: "",
                institutionName: "",
                instituteEmail: "",
                instituteAddress: "",
                employerPhone: "",
                employerName: "",
                employerEmail: "",
                employerAddress: "",
                otherEmploymentStatus: "",
                willAnyonePayForVisit: "",
                fundingPersonName: "",
                tripFundedBy: "",
              },
              documents: {
                documents: {},
              },
              insurance: {
                // For backward compatibility: if app has insurance, apply it to all initial travelers
                insurance: app.insurance || "false",
                insuranceDetails:
                  app.insurance === "true" ? { selected: true } : null,
              },
            })
          );

          // Save the initialized travelersData back to the database for next time
          app.travelersData = JSON.stringify(parsedTravelersData);
          app.save().catch((error) => {
            console.error(
              `Failed to save initialized travelersData for app ${app.id}:`,
              error
            );
          });
        }

        // Add step information for each traveler if not present
        if (Array.isArray(parsedTravelersData)) {
          parsedTravelersData = parsedTravelersData.map((traveler) => {
            const travelerStepInfo = this.getTravelerStepInformation(
              traveler,
              app
            );

            // Remove redundant fields from traveler data and only use stepInfo
            const {
              currentStep,
              completedSteps,
              completed,
              ...cleanTravelerData
            } = traveler;

            return {
              ...cleanTravelerData,
              // Only use stepInfo object for step tracking
              stepInfo: travelerStepInfo, // Complete step info structure for this traveler
            };
          });
        }

        const appJson = app.toJSON();
        const {
          currentStep,
          completedSteps,
          stepProgress,
          stepData,
          ...appWithoutRedundantFields
        } = appJson;

        return {
          ...appWithoutRedundantFields,
          travelersData: parsedTravelersData,
        };
      });

      return { applications: applicationsWithParsedData };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async getUserVisaApplicationById(
    getApplicationByIdDto: GetApplicationByIdDto
  ) {
    try {
      const { id } = getApplicationByIdDto;

      const userVisaApplication = await VisaApplication.findByPk(id);

      if (!userVisaApplication) {
        callHTTPException("Visa application not found");
      }

      console.log(
        "Getting app by ID - Current step from DB:",
        userVisaApplication.currentStep
      );
      console.log(
        "Getting app by ID - Completed steps from DB:",
        userVisaApplication.completedSteps
      );

      // Parse travelersData for easier frontend consumption and add step info
      let parsedTravelersData = null;

      // Handle backward compatibility and missing travelersData
      if (userVisaApplication.travelersData) {
        try {
          parsedTravelersData = JSON.parse(userVisaApplication.travelersData);
        } catch (error) {
          console.error(
            "Error parsing travelersData for app",
            userVisaApplication.id,
            ":",
            error
          );
          parsedTravelersData = null;
        }
      }

      // If travelersData is null/missing, initialize it based on numberOfTravellers
      if (!parsedTravelersData && userVisaApplication.numberOfTravellers) {
        console.log(
          `Initializing missing travelersData for application ${userVisaApplication.id}`
        );
        parsedTravelersData = Array.from(
          { length: userVisaApplication.numberOfTravellers },
          (_, index) => ({
            id: index + 1,
            basicDetails: {
              passportNumber: "",
              firstName: "",
              lastName: "",
              sex: "",
              dateOfBirth: "",
              placeOfBirth: "",
              passportIssuePlace: "",
              passportIssueDate: "",
              passportExpiryDate: "",
              currentAddress1: "",
              currentAddress2: "",
              state: "",
              city: "",
              pincode: "",
              mobileNumber: "",
              passportFront: null,
              passportBack: null,
            },
            visitDetails: {
              visitingOtherSchengenCountries: [],
              firstCountryOfEntry: "",
              hasSchengenVisa: "",
              lastVisaStartDate: "",
              lastVisaEndDate: "",
              hasDigitalFingerprints: "",
              previousVisaNumber: "",
              maritalStatus: "",
              partnerFullName: "",
              partnerDateOfBirth: "",
              employmentStatus: "",
              institutionName: "",
              instituteEmail: "",
              instituteAddress: "",
              employerPhone: "",
              employerName: "",
              employerEmail: "",
              employerAddress: "",
              otherEmploymentStatus: "",
              willAnyonePayForVisit: "",
              fundingPersonName: "",
              tripFundedBy: "",
            },
            documents: {
              documents: {},
            },
            insurance: {
              // For backward compatibility: if app has insurance, apply it to all initial travelers
              insurance: userVisaApplication.insurance || "false",
              insuranceDetails:
                userVisaApplication.insurance === "true"
                  ? { selected: true }
                  : null,
            },
          })
        );

        // Save the initialized travelersData back to the database
        userVisaApplication.travelersData = JSON.stringify(parsedTravelersData);
        await userVisaApplication.save();
      }

      // Add step information for each traveler if not present
      if (Array.isArray(parsedTravelersData)) {
        parsedTravelersData = parsedTravelersData.map((traveler) => {
          const travelerStepInfo = this.getTravelerStepInformation(
            traveler,
            userVisaApplication
          );

          // Remove redundant fields from traveler data and only use stepInfo
          const {
            currentStep,
            completedSteps,
            completed,
            ...cleanTravelerData
          } = traveler;

          return {
            ...cleanTravelerData,
            // Only use stepInfo object for step tracking
            stepInfo: travelerStepInfo, // Complete step info structure for this traveler
          };
        });
      }

      // Return application with parsed travelers data (no global step info)
      const applicationJson = userVisaApplication.toJSON();
      const {
        currentStep,
        completedSteps,
        stepProgress,
        stepData,
        ...applicationWithoutRedundantFields
      } = applicationJson;
      const applicationWithParsedData = {
        ...applicationWithoutRedundantFields,
        travelersData: parsedTravelersData,
      };

      // Debug: Check if visa type data is properly included in the response
      console.log("=== APPLICATION RESPONSE DEBUG ===");
      console.log("Application response includes:");
      console.log("- id:", applicationWithParsedData.id);
      console.log("- email:", applicationWithParsedData.email);
      console.log("- country:", applicationWithParsedData.country);
      console.log("- visaTypeId:", applicationWithParsedData.visaTypeId);
      console.log(
        "- selectedVisaType:",
        applicationWithParsedData.selectedVisaType
          ? {
              id: applicationWithParsedData.selectedVisaType.id,
              name: applicationWithParsedData.selectedVisaType.name,
              type: applicationWithParsedData.selectedVisaType.type,
              price: applicationWithParsedData.selectedVisaType.price,
              priceGBP: applicationWithParsedData.selectedVisaType.priceGBP,
            }
          : "null"
      );
      console.log("- amountPaid:", applicationWithParsedData.amountPaid);
      console.log(
        "- applicationStatus:",
        applicationWithParsedData.applicationStatus
      );
      console.log("=== END APPLICATION RESPONSE DEBUG ===");

      return {
        application: applicationWithParsedData,
      };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async createOrUpdateApplication(dto: VisaApplicationDto) {
    try {
      let application;

      if (dto.type === VisaApplicationStepType.CREATE_APPLICATION) {
        // Process travelers data to set insurance based on application-level insurance selection
        let processedTravelersData = dto.travelersData;

        // If travelersData is not provided or is null, initialize with default structure
        if (!processedTravelersData) {
          console.log(
            "No travelersData provided, initializing with default structure"
          );
          const numberOfTravelers = dto.numberOfTravellers || 1;
          processedTravelersData = [];

          for (let i = 1; i <= numberOfTravelers; i++) {
            processedTravelersData.push({
              id: i,
              // Appointment Details
              appointment: {
                preference1: {
                  city: "",
                  dateRangeStart: null,
                  dateRangeEnd: null,
                  slot: "",
                },
                preference2: {
                  city: "",
                  dateRangeStart: null,
                  dateRangeEnd: null,
                  slot: "",
                },
              },
              // Basic Details (Passport Information)
              basicDetails: {
                passportNumber: "",
                firstName: "",
                lastName: "",
                sex: "",
                dateOfBirth: "",
                placeOfBirth: "",
                passportIssuePlace: "",
                passportIssueDate: "",
                passportExpiryDate: "",
                currentAddress1: "",
                currentAddress2: "",
                state: "",
                city: "",
                pincode: "",
                mobileNumber: "",
                passportFront: null,
                passportBack: null,
                travelStartDate: "",
                travelEndDate: "",
              },
              // Visit Details
              visitDetails: {
                // Travel Information (always present in current form)
                visitingOtherSchengenCountries: [],
                firstCountryOfEntry: "",

                // Visa History (always present in current form)
                hasSchengenVisa: "",
                lastVisaStartDate: "",
                lastVisaEndDate: "",
                hasDigitalFingerprints: "",
                previousVisaNumber: "",

                // Personal Information (always present in current form)
                maritalStatus: "",
                partnerFullName: "",
                partnerDateOfBirth: "",

                // Employment Information (always present in current form)
                employmentStatus: "",
                institutionName: "",
                instituteEmail: "",
                instituteAddress: "",
                employerPhone: "",
                employerName: "",
                employerEmail: "",
                employerAddress: "",
                otherEmploymentStatus: "",

                // Payment Information (always present in current form)
                willAnyonePayForVisit: "",
                fundingPersonName: "",
                tripFundedBy: "",
              },
              // Documents
              documents: {
                documents: {},
              },
              // Insurance
              insurance: {
                insurance: "",
                insuranceDetails: null,
                insuranceCertificate: null,
              },
              // Payment
              payment: {
                appointmentFees: 2060,
                teleportFee: 1524.6,
                cgst: 137.2,
                sgst: 137.2,
                grandTotal: 3859,
                paymentStatus: "pending",
                paymentMethod: "",
                couponCode: "",
                discountAmount: 0,
              },
            });
          }
        }

        if (dto.travelersData && dto.insurance) {
          processedTravelersData = dto.travelersData.map((traveler, index) => {
            // Set insurance for initial travelers based on application insurance selection
            const numberOfPaidTravelers = dto.numberOfTravellers || 1;
            if (index < numberOfPaidTravelers) {
              return {
                ...traveler,
                insurance: {
                  ...traveler.insurance,
                  insurance: dto.insurance, // Apply application-level insurance to initial travelers
                  insuranceDetails:
                    dto.insurance === "true"
                      ? traveler.insurance?.insuranceDetails
                      : null,
                },
              };
            }
            // Additional travelers (beyond paid count) start with no insurance
            return {
              ...traveler,
              insurance: {
                ...traveler.insurance,
                insurance: "false",
                insuranceDetails: null,
              },
            };
          });
        }

        console.log("=== VISA APPLICATION CREATION DEBUG ===");
        console.log("Creating application with visa type data:");
        console.log("- visaTypeId:", dto.visaTypeId);
        console.log("- orderId:", dto.orderId);
        console.log(
          "- selectedVisaType:",
          dto.selectedVisaType
            ? {
                id: dto.selectedVisaType.id,
                name: dto.selectedVisaType.name,
                type: dto.selectedVisaType.type,
                price: dto.selectedVisaType.price,
                priceGBP: dto.selectedVisaType.priceGBP,
              }
            : "null"
        );
        console.log("=== END VISA APPLICATION CREATION DEBUG ===");

        // Create new application - DO NOT store insurance at application level anymore
        application = await VisaApplication.create({
          email: dto.email,
          // insurance: dto.insurance, // REMOVED - no longer store at application level
          country: dto.country,
          visaTypeId: dto.visaTypeId, // Store SMV Konveyor visa type ID
          selectedVisaType: dto.selectedVisaType, // Store complete selected visa type object
          orderId: dto.orderId, // Store SMV Konveyor order ID
          amountPaid: dto.amountPaid,
          applicationStatus: "new",
          currentStep: VisaApplicationStepType.BASIC_DETAILS, // Set to next step immediately
          completedSteps: [VisaApplicationStepType.CREATE_APPLICATION],
          stepProgress: 25,
          // Initialize traveler data structure
          numberOfTravellers: dto.numberOfTravellers || 1,
          travelersData: processedTravelersData
            ? JSON.stringify(processedTravelersData)
            : null,
        });
      } else {
        if (!dto.applicationId) {
          callHTTPException("applicationId is required for this step");
        }

        application = await VisaApplication.findByPk(dto.applicationId);
        if (!application) {
          callHTTPException("Visa application not found");
        }

        // Update step information - now per traveler
        console.log("Before update - Current step:", application.currentStep);
        console.log(
          "Before update - Completed steps:",
          application.completedSteps
        );
        console.log("Processing step type:", dto.type);
        console.log("Current traveler index:", dto.currentTravelerIndex);

        // Parse existing travelers data
        let travelersData = [];
        if (application.travelersData) {
          try {
            travelersData = JSON.parse(application.travelersData);
          } catch (error) {
            console.error("Error parsing existing travelersData:", error);
            travelersData = [];
          }
        }

        // Update step information for the specific traveler
        if (
          dto.currentTravelerIndex !== undefined &&
          travelersData[dto.currentTravelerIndex]
        ) {
          const currentTraveler = travelersData[dto.currentTravelerIndex];

          console.log("=== UPDATING TRAVELER STEP INFO ===");
          console.log("Current step being submitted:", dto.type);
          console.log(
            "Traveler data before update:",
            JSON.stringify(
              filterSensitiveDataForLogging(currentTraveler),
              null,
              2
            )
          );

          // Update traveler's stepInfo only (no more redundant field management)
          // Get current step info and update it based on the submitted step
          const currentStepInfo = this.getTravelerStepInformation(
            currentTraveler,
            application
          );

          console.log("Current step info before update:", currentStepInfo);

          // Add current step to completed steps if not already present
          if (!currentStepInfo.completedSteps.includes(dto.type)) {
            currentStepInfo.completedSteps.push(dto.type);
            console.log("Added step to completed steps:", dto.type);
          }

          // Recalculate completed steps based on actual traveler data
          const calculatedCompletedSteps =
            this.calculateCompletedStepsFromData(currentTraveler);
          console.log(
            "Calculated completed steps from data validation:",
            calculatedCompletedSteps
          );

          // Merge manually completed steps with calculated ones
          // Ensure the current submitted step is always included (manual override)
          const manualSteps = currentStepInfo.completedSteps;
          console.log("Manual completed steps:", manualSteps);

          // Start with manual steps, then add any validated steps that aren't already included
          const allCompletedSteps = [...manualSteps];
          calculatedCompletedSteps.forEach((step) => {
            if (!allCompletedSteps.includes(step)) {
              allCompletedSteps.push(step);
            }
          });

          // Force include the current step being submitted as completed (this ensures manual override works)
          if (!allCompletedSteps.includes(dto.type)) {
            allCompletedSteps.push(dto.type);
            console.log("Force added current step to completed:", dto.type);
          }

          currentStepInfo.completedSteps = allCompletedSteps;

          console.log("Final completed steps after merge:", allCompletedSteps);

          // Find next step after completion
          const allSteps = [
            VisaApplicationStepType.CREATE_APPLICATION,
            VisaApplicationStepType.BASIC_DETAILS,
            VisaApplicationStepType.VISIT_DETAILS,
            VisaApplicationStepType.DOCUMENTS,
            VisaApplicationStepType.APPOINTMENT,
          ];

          // Add insurance step for ALL travelers - no more application-level insurance
          if (!allSteps.includes(VisaApplicationStepType.INSURANCE)) {
            allSteps.push(VisaApplicationStepType.INSURANCE);
          }

          console.log("All possible steps:", allSteps);
          console.log(
            "Completed steps for next step calculation:",
            allCompletedSteps
          );

          let travelerNextStep = null;
          for (const step of allSteps) {
            console.log(
              `Checking step ${step}: completed = ${allCompletedSteps.includes(step)}`
            );
            if (!allCompletedSteps.includes(step)) {
              travelerNextStep = step;
              console.log(`Found next step: ${step}`);
              break;
            }
          }

          console.log("Calculated next step:", travelerNextStep);

          // Update stepInfo with calculated values
          // If there's a next step, that becomes the current step; otherwise stay on the submitted step
          currentStepInfo.currentStep =
            travelerNextStep || currentStepInfo.currentStep;
          currentStepInfo.nextStep = travelerNextStep;
          currentStepInfo.isCompleted = travelerNextStep === null;
          currentStepInfo.stepProgress =
            (allCompletedSteps.length / allSteps.length) * 100;

          // Store updated stepInfo in traveler
          currentTraveler.stepInfo = currentStepInfo;

          console.log("Updated traveler stepInfo:", currentStepInfo);
          console.log("=== END UPDATING TRAVELER STEP INFO ===");

          // After updating this traveler's step info, check if all travelers are now completed
          // and update application status accordingly
          const updatedTravelersData = dto.travelersData || travelersData;
          if (
            this.areAllTravelersCompleted(updatedTravelersData, application)
          ) {
            if (application.applicationStatus !== "submitted") {
              application.applicationStatus = "submitted";
              console.log(
                "All travelers now completed - updating application status to submitted"
              );
            }
          }
        }

        // No more global step tracking - only traveler-specific stepInfo is managed

        if (dto.type === VisaApplicationStepType.BASIC_DETAILS) {
          console.log("=== BASIC_DETAILS BACKEND DEBUG ===");
          // Filter out sensitive data from logging to avoid console clutter
          const dtoForLogging = filterSensitiveDataForLogging(dto);
          console.log("dto received:", JSON.stringify(dtoForLogging, null, 2));
          console.log(
            "dto.travelersData:",
            dto.travelersData
              ? `${dto.travelersData.length} travelers (sensitive data filtered from logs)`
              : "undefined"
          );
          console.log("dto.currentTravelerIndex:", dto.currentTravelerIndex);

          // If frontend sent only basicDetails (not full travelersData), merge those
          // into the existing travelersData entry for the current traveler index.
          const incomingBasic = (dto as any).basicDetails;
          if (incomingBasic && typeof dto.currentTravelerIndex === "number") {
            console.log(
              "Merging incoming basicDetails into existing traveler entry"
            );
            try {
              if (travelersData[dto.currentTravelerIndex]) {
                travelersData[dto.currentTravelerIndex].basicDetails = {
                  ...(travelersData[dto.currentTravelerIndex].basicDetails ||
                    {}),
                  ...incomingBasic,
                };
                console.log(
                  "Merged basicDetails for traveler",
                  dto.currentTravelerIndex,
                  JSON.stringify({
                    mobileNumber:
                      travelersData[dto.currentTravelerIndex].basicDetails
                        .mobileNumber,
                    travelStartDate:
                      travelersData[dto.currentTravelerIndex].basicDetails
                        .travelStartDate,
                    travelEndDate:
                      travelersData[dto.currentTravelerIndex].basicDetails
                        .travelEndDate,
                  })
                );
              }
            } catch (err) {
              console.error("Error while merging basicDetails:", err);
            }
          }

          // Use updated travelers data or merge with existing data
          if (dto.travelersData && Array.isArray(dto.travelersData)) {
            console.log(
              "Storing updated travelers data: [sensitive data filtered from logs]"
            );
            application.travelersData = JSON.stringify(dto.travelersData);

            // Recalculate all travelers' step completion after storing basic details
            this.recalculateAllTravelersSteps(dto.travelersData, application);

            // Check if any traveler has incomplete steps and update application status accordingly
            this.checkAndUpdateApplicationStatusForIncompleteTravelers(
              dto.travelersData,
              application
            );
          } else if (travelersData.length > 0) {
            // Store the updated travelers data with step tracking
            console.log(
              "Storing merged travelers data:",
              JSON.stringify(travelersData, null, 2)
            );
            application.travelersData = JSON.stringify(travelersData);

            // Recalculate all travelers' step completion
            this.recalculateAllTravelersSteps(travelersData, application);

            // Check if any traveler has incomplete steps and update application status accordingly
            this.checkAndUpdateApplicationStatusForIncompleteTravelers(
              travelersData,
              application
            );
          }

          if (dto.numberOfTravellers) {
            application.numberOfTravellers = dto.numberOfTravellers;
          }

          console.log(
            "Final stored travelersData: [sensitive data filtered from logs]"
          );
          console.log("=== END BASIC_DETAILS BACKEND DEBUG ===");
        }

        if (dto.type === VisaApplicationStepType.VISIT_DETAILS) {
          // Use updated travelers data or store the merged data with step tracking
          if (dto.travelersData && Array.isArray(dto.travelersData)) {
            application.travelersData = JSON.stringify(dto.travelersData);
            this.recalculateAllTravelersSteps(dto.travelersData, application);
            this.checkAndUpdateApplicationStatusForIncompleteTravelers(
              dto.travelersData,
              application
            );
          } else if (travelersData.length > 0) {
            application.travelersData = JSON.stringify(travelersData);
            this.recalculateAllTravelersSteps(travelersData, application);
            this.checkAndUpdateApplicationStatusForIncompleteTravelers(
              travelersData,
              application
            );
          }
        }

        if (dto.type === VisaApplicationStepType.APPOINTMENT) {
          console.log("=== APPOINTMENT STEP HANDLER TRIGGERED ===");
          console.log("dto.currentTravelerIndex:", dto.currentTravelerIndex);
          console.log("dto.appointment exists:", !!(dto as any).appointment);
          console.log(
            "dto.appointment:",
            JSON.stringify((dto as any).appointment, null, 2)
          );
          console.log(
            "dto.travelersData length:",
            dto.travelersData?.length || "no travelersData"
          );
          console.log(
            "travelersData length:",
            travelersData?.length || "no travelersData"
          );

          // Handle appointment step - merge incoming appointment data into the current traveler
          const incomingAppointment = (dto as any).appointment;

          if (incomingAppointment && dto.currentTravelerIndex !== undefined) {
            console.log("=== MERGING APPOINTMENT DATA ===");
            console.log(
              "travelersData[dto.currentTravelerIndex] exists:",
              !!travelersData[dto.currentTravelerIndex]
            );
            if (travelersData[dto.currentTravelerIndex]) {
              console.log(
                "Current traveler appointment before merge:",
                JSON.stringify(
                  travelersData[dto.currentTravelerIndex].appointment,
                  null,
                  2
                )
              );
            }

            try {
              if (travelersData[dto.currentTravelerIndex]) {
                travelersData[dto.currentTravelerIndex].appointment = {
                  ...(travelersData[dto.currentTravelerIndex].appointment ||
                    {}),
                  ...incomingAppointment,
                };

                console.log(
                  `Merged appointment for traveler ${dto.currentTravelerIndex}:`,
                  JSON.stringify(
                    travelersData[dto.currentTravelerIndex].appointment
                  )
                );
              }
            } catch (err) {
              console.error("Error while merging appointment:", err);
            }
          } else {
            console.log("=== APPOINTMENT MERGE SKIPPED ===");
            console.log("incomingAppointment:", !!incomingAppointment);
            console.log("dto.currentTravelerIndex:", dto.currentTravelerIndex);
          }

          // Use updated travelers data or merge with existing data
          if (dto.travelersData && Array.isArray(dto.travelersData)) {
            console.log(
              "Storing updated travelers data from frontend (includes merged appointment)"
            );
            application.travelersData = JSON.stringify(dto.travelersData);
            this.recalculateAllTravelersSteps(dto.travelersData, application);
            this.checkAndUpdateApplicationStatusForIncompleteTravelers(
              dto.travelersData,
              application
            );
          } else if (travelersData.length > 0) {
            // Store the updated travelers data with merged appointment
            console.log("Storing merged travelers data with appointment");
            application.travelersData = JSON.stringify(travelersData);
            this.recalculateAllTravelersSteps(travelersData, application);
            this.checkAndUpdateApplicationStatusForIncompleteTravelers(
              travelersData,
              application
            );
          }

          // Update application submitted status only if all travelers are completed
          const currentTravelersData = dto.travelersData || travelersData;
          if (
            this.areAllTravelersCompleted(currentTravelersData, application)
          ) {
            application.applicationStatus = "submitted";
            console.log(
              "All travelers completed after appointment - setting application status to submitted"
            );
          } else {
            console.log(
              "Not all travelers completed after appointment - keeping status as is"
            );
          }
        }

        if (dto.type === VisaApplicationStepType.DOCUMENTS) {
          // Use updated travelers data or store the merged data with step tracking
          if (dto.travelersData && Array.isArray(dto.travelersData)) {
            application.travelersData = JSON.stringify(dto.travelersData);
            this.recalculateAllTravelersSteps(dto.travelersData, application);
            this.checkAndUpdateApplicationStatusForIncompleteTravelers(
              dto.travelersData,
              application
            );
          } else if (travelersData.length > 0) {
            application.travelersData = JSON.stringify(travelersData);
            this.recalculateAllTravelersSteps(travelersData, application);
            this.checkAndUpdateApplicationStatusForIncompleteTravelers(
              travelersData,
              application
            );
          }

          // Only mark application as submitted if all travelers have completed their insurance AND all steps
          const currentTravelersData = dto.travelersData || travelersData;
          if (
            this.areAllTravelersCompleted(currentTravelersData, application)
          ) {
            application.applicationStatus = "submitted";
            console.log(
              "All travelers completed - setting application status to submitted"
            );
          } else {
            console.log(
              "Not all travelers completed yet - keeping application status as is"
            );
          }
        }

        if (dto.type === VisaApplicationStepType.INSURANCE) {
          // Handle traveler insurance payment (both regular and additional)
          if (
            dto.paymentType === "additional_traveler_insurance" ||
            dto.paymentType === "traveler_insurance"
          ) {
            // Update the specific traveler's insurance status after successful payment
            if (
              dto.currentTravelerIndex !== undefined &&
              travelersData[dto.currentTravelerIndex]
            ) {
              const currentTraveler = travelersData[dto.currentTravelerIndex];
              console.log(
                "Current traveler before update:",
                JSON.stringify(currentTraveler.insurance, null, 2)
              );

              if (!currentTraveler.insurance) {
                currentTraveler.insurance = {};
              }
              currentTraveler.insurance.insurance = "true"; // Insurance paid and active
              currentTraveler.insurance.insuranceDetails = {
                selected: true,
                paid: true,
                paymentType: dto.paymentType,
                amountPaid: dto.amountPaid || "2500",
              };

              console.log(
                "Current traveler after update:",
                JSON.stringify(currentTraveler.insurance, null, 2)
              );
              console.log(
                `✅ Successfully updated insurance for traveler ${dto.currentTravelerIndex + 1}: paid`
              );

              // Update the travelers data in the application
              application.travelersData = JSON.stringify(travelersData);
              console.log("Updated application.travelersData in database");
              this.recalculateAllTravelersSteps(travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                travelersData,
                application
              );
              console.log("=== END TRAVELER INSURANCE PAYMENT PROCESSING ===");
            } else {
              console.error(
                "❌ Failed to update insurance - traveler not found"
              );
              console.error(
                `Requested traveler index: ${dto.currentTravelerIndex}`
              );
              console.error(`travelersData length: ${travelersData.length}`);
              console.error(
                "Available traveler indices:",
                travelersData.map((t, i) => ({ index: i, id: t.id }))
              );
              console.log(
                "=== END TRAVELER INSURANCE PAYMENT PROCESSING (ERROR) ==="
              );
            }
          } else {
            // Regular insurance step handling (non-payment flow)
            // Use updated travelers data or store the merged data with step tracking
            if (dto.travelersData && Array.isArray(dto.travelersData)) {
              console.log("=== PROCESSING TRAVELERS DATA FOR INSURANCE ===");
              console.log(
                "Number of travelers in dto.travelersData:",
                dto.travelersData.length
              );
              console.log("Current traveler index:", dto.currentTravelerIndex);

              // If we have travelers data from frontend, use it directly (it contains the complete insurance data)
              application.travelersData = JSON.stringify(dto.travelersData);
              console.log(
                "✅ Stored complete travelers data from frontend (includes insurance certificate)"
              );

              this.recalculateAllTravelersSteps(dto.travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                dto.travelersData,
                application
              );
            } else if (travelersData.length > 0) {
              // Fallback: merge with existing data
              console.log("=== FALLBACK: MERGING WITH EXISTING DATA ===");

              // Store insurance at traveler level (dto.insurance should contain the traveler's insurance choice)
              // The insurance is now handled per traveler, not at application level
              if (
                dto.currentTravelerIndex !== undefined &&
                travelersData[dto.currentTravelerIndex]
              ) {
                const currentTraveler = travelersData[dto.currentTravelerIndex];
                if (!currentTraveler.insurance) {
                  currentTraveler.insurance = {};
                }

                console.log("=== INSURANCE DATA MERGE DEBUG (FALLBACK) ===");
                console.log("dto.insurance:", dto.insurance);
                console.log("dto.insuranceDetails:", dto.insuranceDetails);
                console.log(
                  "dto.insuranceCertificate exists:",
                  !!dto.insuranceCertificate
                );
                console.log(
                  "Current traveler insurance before merge:",
                  JSON.stringify(currentTraveler.insurance, null, 2)
                );

                // Properly merge the complete insurance data instead of just the insurance selection
                currentTraveler.insurance.insurance = dto.insurance;

                // Merge insurance details if provided
                if (dto.insuranceDetails) {
                  currentTraveler.insurance.insuranceDetails =
                    dto.insuranceDetails;
                  console.log(
                    "✅ Merged insuranceDetails:",
                    dto.insuranceDetails
                  );
                }

                // Merge insurance certificate if provided
                if (dto.insuranceCertificate) {
                  currentTraveler.insurance.insuranceCertificate =
                    dto.insuranceCertificate;
                  console.log("✅ Merged insuranceCertificate:", {
                    name: dto.insuranceCertificate.name,
                    type: dto.insuranceCertificate.type,
                    size: dto.insuranceCertificate.size,
                    hasData: !!dto.insuranceCertificate.data,
                  });
                }

                console.log(
                  "Current traveler insurance after merge:",
                  JSON.stringify(
                    {
                      ...currentTraveler.insurance,
                      insuranceCertificate: currentTraveler.insurance
                        .insuranceCertificate
                        ? {
                            name: currentTraveler.insurance.insuranceCertificate
                              .name,
                            type: currentTraveler.insurance.insuranceCertificate
                              .type,
                            size: currentTraveler.insurance.insuranceCertificate
                              .size,
                            hasData:
                              !!currentTraveler.insurance.insuranceCertificate
                                .data,
                          }
                        : undefined,
                    },
                    null,
                    2
                  )
                );
                console.log(
                  "=== END INSURANCE DATA MERGE DEBUG (FALLBACK) ==="
                );

                console.log(
                  `✅ Stored complete insurance data for traveler ${dto.currentTravelerIndex + 1}: ${dto.insurance}`
                );
              }

              application.travelersData = JSON.stringify(travelersData);
              this.recalculateAllTravelersSteps(travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                travelersData,
                application
              );
            }
          }

          // Only mark application as submitted if ALL travelers have completed their steps
          const currentTravelersData = dto.travelersData || travelersData;
          if (
            this.areAllTravelersCompleted(currentTravelersData, application)
          ) {
            application.applicationStatus = "submitted";
            console.log(
              "All travelers completed insurance step - setting application status to submitted"
            );
          } else {
            // Check if any additional travelers need insurance payment
            const hasUnpaidAdditionalTravelers =
              this.checkForUnpaidAdditionalTravelers(
                currentTravelersData,
                application
              );
            if (hasUnpaidAdditionalTravelers) {
              application.applicationStatus = "payment_required";
              console.log(
                "Additional travelers require insurance payment - setting status to payment_required"
              );
            } else {
              console.log(
                "Not all travelers completed yet - keeping application status as is"
              );
            }
          }

          console.log("=== END INSURANCE STEP PROCESSING ===");
        }

        // PAYMENT step handling: merge payment information into traveler/payment and update statuses
        if (dto.type === VisaApplicationStepType.PAYMENT) {
          console.log("=== PAYMENT STEP HANDLER TRIGGERED ===");
          const incomingPayment = (dto as any).payment;

          if (
            incomingPayment &&
            dto.currentTravelerIndex !== undefined &&
            travelersData[dto.currentTravelerIndex]
          ) {
            try {
              const currentTraveler = travelersData[dto.currentTravelerIndex];
              if (!currentTraveler.payment) currentTraveler.payment = {};

              // Merge payment info
              currentTraveler.payment = {
                ...currentTraveler.payment,
                ...incomingPayment,
              };

              const status = (
                incomingPayment.paymentStatus ||
                currentTraveler.payment.paymentStatus ||
                ""
              ).toLowerCase();
              if (
                status === "completed" ||
                status === "paid" ||
                status === "success"
              ) {
                currentTraveler.payment.paymentStatus = "completed";
                currentTraveler.payment.amountPaid =
                  incomingPayment.amountPaid ||
                  currentTraveler.payment.amountPaid;
                currentTraveler.payment.paymentDate =
                  incomingPayment.paymentDate || new Date().toISOString();
                console.log(
                  `✅ Payment recorded for traveler ${dto.currentTravelerIndex}`
                );
              } else if (status === "processing" || status === "pending") {
                currentTraveler.payment.paymentStatus = "processing";
              }

              application.travelersData = JSON.stringify(travelersData);
              this.recalculateAllTravelersSteps(travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                travelersData,
                application
              );

              if (this.areAllTravelersCompleted(travelersData, application)) {
                application.applicationStatus = "submitted";
              }
            } catch (err) {
              console.error("Error processing payment step:", err);
            }
          } else if (dto.travelersData && Array.isArray(dto.travelersData)) {
            application.travelersData = JSON.stringify(dto.travelersData);
            this.recalculateAllTravelersSteps(dto.travelersData, application);
            this.checkAndUpdateApplicationStatusForIncompleteTravelers(
              dto.travelersData,
              application
            );

            if (this.areAllTravelersCompleted(dto.travelersData, application)) {
              application.applicationStatus = "submitted";
            }
          } else {
            console.log(
              "Payment step received with no traveler or travelersData to merge"
            );
          }
        }

        await application.save();

        console.log("After save - Current step:", application.currentStep);
        console.log(
          "After save - Completed steps:",
          application.completedSteps
        );
      }

      // Parse travelersData for frontend consumption and add step info
      let parsedTravelersData = null;
      if (application.travelersData) {
        try {
          parsedTravelersData = JSON.parse(application.travelersData);

          // Add step information for each traveler if not present
          if (Array.isArray(parsedTravelersData)) {
            parsedTravelersData = parsedTravelersData.map((traveler, index) => {
              console.log(`=== TRAVELER ${index + 1} CLEANING DEBUG ===`);
              console.log(
                "Original traveler data keys:",
                Object.keys(traveler)
              );
              console.log(
                "Original traveler insurance:",
                traveler.insurance
                  ? {
                      insurance: traveler.insurance.insurance,
                      hasDetails: !!traveler.insurance.insuranceDetails,
                      hasCertificate: !!traveler.insurance.insuranceCertificate,
                      insuranceDetails: traveler.insurance.insuranceDetails,
                      certificateInfo: traveler.insurance.insuranceCertificate
                        ? {
                            name: traveler.insurance.insuranceCertificate.name,
                            type: traveler.insurance.insuranceCertificate.type,
                            size: traveler.insurance.insuranceCertificate.size,
                            hasData:
                              !!traveler.insurance.insuranceCertificate.data,
                          }
                        : null,
                    }
                  : "No insurance data"
              );

              const travelerStepInfo = this.getTravelerStepInformation(
                traveler,
                application
              );

              // Remove redundant fields from traveler data and only use stepInfo
              const {
                currentStep,
                completedSteps,
                completed,
                ...cleanTravelerData
              } = traveler;

              console.log(
                "Clean traveler data keys:",
                Object.keys(cleanTravelerData)
              );
              console.log(
                "Clean traveler insurance:",
                cleanTravelerData.insurance
                  ? {
                      insurance: cleanTravelerData.insurance.insurance,
                      hasDetails:
                        !!cleanTravelerData.insurance.insuranceDetails,
                      hasCertificate:
                        !!cleanTravelerData.insurance.insuranceCertificate,
                      insuranceDetails:
                        cleanTravelerData.insurance.insuranceDetails,
                      certificateInfo: cleanTravelerData.insurance
                        .insuranceCertificate
                        ? {
                            name: cleanTravelerData.insurance
                              .insuranceCertificate.name,
                            type: cleanTravelerData.insurance
                              .insuranceCertificate.type,
                            size: cleanTravelerData.insurance
                              .insuranceCertificate.size,
                            hasData:
                              !!cleanTravelerData.insurance.insuranceCertificate
                                .data,
                          }
                        : null,
                    }
                  : "No insurance data in clean data"
              );

              const finalTravelerData = {
                ...cleanTravelerData,
                // Only use stepInfo object for step tracking
                stepInfo: travelerStepInfo, // Complete step info structure for this traveler
              };

              console.log(
                "Final traveler data keys:",
                Object.keys(finalTravelerData)
              );
              console.log(
                "Final traveler insurance:",
                finalTravelerData.insurance
                  ? {
                      insurance: finalTravelerData.insurance.insurance,
                      hasDetails:
                        !!finalTravelerData.insurance.insuranceDetails,
                      hasCertificate:
                        !!finalTravelerData.insurance.insuranceCertificate,
                    }
                  : "No insurance data in final data"
              );
              console.log(`=== END TRAVELER ${index + 1} CLEANING DEBUG ===`);

              return finalTravelerData;
            });
          }
        } catch (error) {
          console.error("Error parsing travelersData:", error);
          parsedTravelersData = null;
        }
      }

      // Return application with parsed travelers data (no global step info)
      const applicationJson = application.toJSON();
      const {
        currentStep,
        completedSteps,
        stepProgress,
        stepData,
        ...applicationWithoutRedundantFields
      } = applicationJson;

      const applicationWithParsedData = {
        ...applicationWithoutRedundantFields,
        travelersData: parsedTravelersData,
      };

      // Debug: Check if insurance data is properly included in the response
      console.log("=== FINAL RESPONSE DEBUG ===");
      if (parsedTravelersData && Array.isArray(parsedTravelersData)) {
        parsedTravelersData.forEach((traveler, index) => {
          console.log(`Traveler ${index + 1} Data in Response:`);
          console.log("- Traveler ID:", traveler.id);
          console.log("- Has appointment:", !!traveler.appointment);
          if (traveler.appointment) {
            console.log(
              "- Appointment data:",
              JSON.stringify(traveler.appointment, null, 2)
            );
          } else {
            console.log("- Appointment data: null/undefined");
          }
          console.log(
            "- StepInfo completedSteps:",
            traveler.stepInfo?.completedSteps || []
          );
          console.log(
            "- StepInfo currentStep:",
            traveler.stepInfo?.currentStep
          );
          console.log(
            "- StepInfo isCompleted:",
            traveler.stepInfo?.isCompleted
          );

          if (traveler.insurance) {
            console.log(`Traveler ${index + 1} Insurance Data in Response:`);
            console.log("- Insurance selection:", traveler.insurance.insurance);
            console.log(
              "- Insurance details exist:",
              !!traveler.insurance.insuranceDetails
            );
            console.log(
              "- Insurance certificate exists:",
              !!traveler.insurance.insuranceCertificate
            );
            if (traveler.insurance.insuranceDetails) {
              console.log(
                "- Insurance details:",
                traveler.insurance.insuranceDetails
              );
            } else {
              console.log("- Insurance details: null/undefined");
            }
            if (traveler.insurance.insuranceCertificate) {
              console.log("- Insurance certificate info:", {
                name: traveler.insurance.insuranceCertificate.name,
                type: traveler.insurance.insuranceCertificate.type,
                size: traveler.insurance.insuranceCertificate.size,
                hasData: !!traveler.insurance.insuranceCertificate.data,
              });
            } else {
              console.log("- Insurance certificate: null/undefined");
            }
          }
        });
      }
      console.log("=== END FINAL RESPONSE DEBUG ===");

      return {
        application: applicationWithParsedData,
      };
    } catch (err) {
      console.log("err ::: ", err);
      callHTTPException(err.message);
    }
  }

  async deleteVisaApplication(dto: VisaApplicationDeleteDto) {
    try {
      return "application";
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  // Helper method to get step information - focused on global application status
  private getStepInformation(application: VisaApplication) {
    const allSteps = [
      VisaApplicationStepType.CREATE_APPLICATION,
      VisaApplicationStepType.BASIC_DETAILS,
      VisaApplicationStepType.VISIT_DETAILS,
      VisaApplicationStepType.DOCUMENTS,
      VisaApplicationStepType.APPOINTMENT,
    ];

    // Add insurance step for all applications since it's now handled at traveler level
    allSteps.push(VisaApplicationStepType.INSURANCE);

    const completedSteps = application.completedSteps || [];
    const currentStep =
      application.currentStep || VisaApplicationStepType.CREATE_APPLICATION;
    const stepProgress = application.stepProgress || 0;

    // Find next step - should be the first step not in completed steps
    let nextStep = null;
    for (const step of allSteps) {
      if (!completedSteps.includes(step)) {
        nextStep = step;
        break;
      }
    }

    // Determine if application is completed/submitted - this is the main purpose of global step info
    let isCompleted = false;
    let isSubmitted = false;

    // Since insurance and appointment are handled at traveler level, application is completed when all travelers are completed
    // If travelersData is available, rely on recalculation to determine completion
    let travelersData: any[] = [];
    try {
      travelersData = application.travelersData
        ? JSON.parse(application.travelersData)
        : [];
    } catch (err) {
      travelersData = [];
    }

    isCompleted = this.areAllTravelersCompleted(travelersData, application);
    isSubmitted = application.applicationStatus === "submitted";

    return {
      currentStep,
      completedSteps,
      stepProgress,
      nextStep,
      totalSteps: allSteps.length,
      isCompleted,
      isSubmitted, // Main indicator for application submission status
      applicationStatus: application.applicationStatus,
      stepNames: {
        [VisaApplicationStepType.CREATE_APPLICATION]: "Application Created",
        [VisaApplicationStepType.BASIC_DETAILS]: "Basic Details",
        [VisaApplicationStepType.VISIT_DETAILS]: "Visit Details",
        [VisaApplicationStepType.DOCUMENTS]: "Documents Upload",
        [VisaApplicationStepType.APPOINTMENT]: "Appointment",
        [VisaApplicationStepType.PAYMENT]: "Payment",
        [VisaApplicationStepType.INSURANCE]: "Insurance",
      },
    };
  }

  // Helper method to get step information for a specific traveler
  private getTravelerStepInformation(
    travelerData: any,
    application: VisaApplication
  ) {
    console.log("=== GET TRAVELER STEP INFORMATION ===");
    console.log("Traveler ID:", travelerData.id);

    const allSteps = [
      VisaApplicationStepType.CREATE_APPLICATION,
      VisaApplicationStepType.BASIC_DETAILS,
      VisaApplicationStepType.VISIT_DETAILS,
      VisaApplicationStepType.DOCUMENTS,
      // Appointment step is required in the traveler flow
      VisaApplicationStepType.APPOINTMENT,
      VisaApplicationStepType.PAYMENT, // Add payment step
    ];

    // Determine if this traveler needs insurance step
    const paidTravelerCount = application.numberOfTravellers || 1;
    const travelerIndex = travelerData.id ? parseInt(travelerData.id) - 1 : 0;
    const isAdditionalTraveler = travelerIndex >= paidTravelerCount;

    // Check if this traveler has insurance at traveler level ONLY
    const travelerInsurance = travelerData.insurance;
    const travelerHasInsurance =
      travelerInsurance &&
      travelerInsurance.insurance &&
      (travelerInsurance.insurance === "true" ||
        (travelerInsurance.insurance === "own" &&
          travelerInsurance.insuranceCertificate &&
          travelerInsurance.insuranceDetails?.certificateUploaded));

    // For backward compatibility: if traveler doesn't have insurance but application has insurance,
    // consider the traveler as having insurance (for existing applications)
    const hasBackwardCompatibilityInsurance =
      !travelerHasInsurance &&
      application.insurance &&
      application.insurance !== "false";

    const effectivelyHasInsurance =
      travelerHasInsurance || hasBackwardCompatibilityInsurance;

    // ALL travelers need insurance step if they don't have complete insurance coverage
    const needsInsuranceStep = !effectivelyHasInsurance;

    if (needsInsuranceStep) {
      if (!allSteps.includes(VisaApplicationStepType.INSURANCE)) {
        allSteps.push(VisaApplicationStepType.INSURANCE);
      }
    }

    if (isAdditionalTraveler) {
      console.log(
        `Traveler ${travelerData.id} is additional (beyond paid count of ${paidTravelerCount}) - must handle own insurance`
      );
    }

    console.log("All steps:", allSteps);

    // Intelligently calculate completed steps based on actual traveler data
    const calculatedCompletedSteps =
      this.calculateCompletedStepsFromData(travelerData);

    // Use calculated steps if available, otherwise fall back to stored completedSteps
    const completedSteps =
      calculatedCompletedSteps.length > 0
        ? calculatedCompletedSteps
        : travelerData.completedSteps || [];

    console.log("Final completed steps:", completedSteps);

    // Determine current step based on what's completed and what's next
    let currentStep =
      travelerData.currentStep || VisaApplicationStepType.BASIC_DETAILS;

    // Find next step - should be the first step not in completed steps
    let nextStep = null;
    for (const step of allSteps) {
      if (!completedSteps.includes(step)) {
        nextStep = step;
        break;
      }
    }

    console.log("Next step found:", nextStep);

    // If we found a next step, that should be the current step (unless it's CREATE_APPLICATION)
    if (nextStep && nextStep !== VisaApplicationStepType.CREATE_APPLICATION) {
      currentStep = nextStep;
    }

    console.log("Final current step:", currentStep);
    console.log("=== END GET TRAVELER STEP INFORMATION ===");

    // Calculate step progress based on completed steps
    const stepProgressMap = {
      [VisaApplicationStepType.CREATE_APPLICATION]: 16,
      [VisaApplicationStepType.BASIC_DETAILS]: 33,
      [VisaApplicationStepType.VISIT_DETAILS]: 50,
      [VisaApplicationStepType.DOCUMENTS]: 66,
      [VisaApplicationStepType.APPOINTMENT]: 83,
      [VisaApplicationStepType.PAYMENT]: 100, // Add payment step progress
    };

    // If this traveler has insurance and doesn't need insurance step, documents = 100%
    const hasInsurance = effectivelyHasInsurance;
    if (hasInsurance && !needsInsuranceStep) {
      stepProgressMap[VisaApplicationStepType.DOCUMENTS] = 100;
    }

    // Calculate progress based on latest completed step
    let stepProgress = 0;
    for (const step of completedSteps) {
      if (stepProgressMap[step] > stepProgress) {
        stepProgress = stepProgressMap[step];
      }
    }

    // Determine if traveler is completed
    let isCompleted = false;
    if (needsInsuranceStep) {
      // If insurance step is required, traveler must complete it
      isCompleted = completedSteps.includes(VisaApplicationStepType.INSURANCE);
    } else {
      // If insurance is already handled at traveler level, traveler must complete documents, appointment, AND payment
      isCompleted =
        completedSteps.includes(VisaApplicationStepType.DOCUMENTS) &&
        completedSteps.includes(VisaApplicationStepType.APPOINTMENT) &&
        completedSteps.includes(VisaApplicationStepType.PAYMENT); // Add payment requirement
    }

    // Set current step to "completed" for frontend display if traveler is actually completed
    let displayCurrentStep = currentStep;
    if (isCompleted && nextStep === null) {
      displayCurrentStep = "completed";
    }

    return {
      currentStep: displayCurrentStep,
      completedSteps,
      stepProgress,
      nextStep,
      totalSteps: allSteps.length,
      isCompleted,
      isAdditionalTraveler, // Flag to indicate if this traveler requires additional payment
      requiresInsurance: needsInsuranceStep,
      hasInsurance: effectivelyHasInsurance, // Whether traveler has insurance (from any source including backward compatibility)
      stepNames: {
        [VisaApplicationStepType.CREATE_APPLICATION]: "Application Created",
        [VisaApplicationStepType.BASIC_DETAILS]: "Basic Details",
        [VisaApplicationStepType.VISIT_DETAILS]: "Visit Details",
        [VisaApplicationStepType.DOCUMENTS]: "Documents Upload",
        [VisaApplicationStepType.APPOINTMENT]: "Appointment",
        [VisaApplicationStepType.PAYMENT]: "Payment",
        [VisaApplicationStepType.INSURANCE]: "Insurance",
      },
    };
  }

  // Helper method to calculate completed steps based on actual traveler data
  private calculateCompletedStepsFromData(travelerData: any): string[] {
    const completedSteps = [];

    console.log("=== CALCULATING COMPLETED STEPS ===");
    // console.log("Traveler data:", JSON.stringify(filterSensitiveDataForLogging(travelerData), null, 2));

    // Always include CREATE_APPLICATION
    completedSteps.push(VisaApplicationStepType.CREATE_APPLICATION);

    // Check Basic Details completion
    if (this.isBasicDetailsComplete(travelerData.basicDetails)) {
      completedSteps.push(VisaApplicationStepType.BASIC_DETAILS);
      console.log("Basic details is complete");
    } else {
      console.log("Basic details is NOT complete");
    }

    // Check Visit Details completion
    if (this.isVisitDetailsComplete(travelerData.visitDetails)) {
      completedSteps.push(VisaApplicationStepType.VISIT_DETAILS);
      console.log("Visit details is complete");
    } else {
      console.log("Visit details is NOT complete");
    }

    // Check Documents completion
    if (this.isDocumentsComplete(travelerData.documents)) {
      completedSteps.push(VisaApplicationStepType.DOCUMENTS);
      console.log("Documents is complete");
    } else {
      console.log("Documents is NOT complete");
    }

    // Check Appointment completion
    if (this.isAppointmentComplete(travelerData.appointment)) {
      completedSteps.push(VisaApplicationStepType.APPOINTMENT);
      console.log("Appointment is complete - added to completedSteps");
    } else {
      console.log("Appointment is NOT complete - NOT added to completedSteps");
    }

    // Check Payment completion
    if (this.isPaymentComplete(travelerData.payment)) {
      completedSteps.push(VisaApplicationStepType.PAYMENT);
      console.log("Payment is complete - added to completedSteps");
    } else {
      console.log("Payment is NOT complete - NOT added to completedSteps");
    }

    // Check Insurance completion (if required)
    if (this.isInsuranceComplete(travelerData.insurance)) {
      completedSteps.push(VisaApplicationStepType.INSURANCE);
      console.log("Insurance is complete");
    } else {
      console.log("Insurance is NOT complete");
    }

    console.log("Final calculated completed steps:", completedSteps);
    console.log("=== END CALCULATING COMPLETED STEPS ===");

    return completedSteps;
  }

  // Helper to validate appointment completeness
  private isAppointmentComplete(appointment: any): boolean {
    console.log("=== CHECKING APPOINTMENT COMPLETENESS ===");
    console.log("Appointment data:", JSON.stringify(appointment, null, 2));

    if (!appointment) {
      console.log("Appointment validation failed: no appointment object");
      return false;
    }

    // Expect at least preference1 to have city + slot or dateRange
    const pref1 = appointment.preference1 || {};
    const hasCity = !!(pref1.city && pref1.city.trim());
    const hasSlot = !!(pref1.slot && pref1.slot.trim());
    const hasDateRange = !!(pref1.dateRange && pref1.dateRange.trim());

    console.log("Appointment validation details:");
    console.log("- Has city:", hasCity, "(value:", pref1.city, ")");
    console.log("- Has slot:", hasSlot, "(value:", pref1.slot, ")");
    console.log(
      "- Has dateRange:",
      hasDateRange,
      "(value:",
      pref1.dateRange,
      ")"
    );
    console.log("- Overall complete:", hasCity && (hasSlot || hasDateRange));

    console.log("=== END APPOINTMENT COMPLETENESS CHECK ===");
    return hasCity && (hasSlot || hasDateRange);
  }

  // Helper to validate payment completeness
  private isPaymentComplete(payment: any): boolean {
    console.log("=== CHECKING PAYMENT COMPLETENESS ===");
    console.log("Payment data:", JSON.stringify(payment, null, 2));

    if (!payment) {
      console.log("Payment validation failed: no payment object");
      return false;
    }

    // Check if payment status is completed
    const paymentStatus = payment.paymentStatus;
    const isCompleted =
      paymentStatus === "completed" || paymentStatus === "paid";

    console.log("Payment validation details:");
    console.log("- Payment status:", paymentStatus);
    console.log("- Is completed:", isCompleted);

    console.log("=== END PAYMENT COMPLETENESS CHECK ===");
    return isCompleted;
  }

  // Validation methods for each step
  private isBasicDetailsComplete(basicDetails: any): boolean {
    if (!basicDetails) return false;

    return !!(
      basicDetails.passportNumber &&
      basicDetails.firstName &&
      basicDetails.lastName &&
      basicDetails.sex &&
      basicDetails.dateOfBirth &&
      basicDetails.placeOfBirth &&
      basicDetails.passportIssuePlace &&
      basicDetails.passportIssueDate &&
      basicDetails.passportExpiryDate &&
      basicDetails.currentAddress1 &&
      basicDetails.city &&
      basicDetails.pincode &&
      basicDetails.mobileNumber &&
      basicDetails.passportFront &&
      basicDetails.passportBack
    );
  }

  private isVisitDetailsComplete(visitDetails: any): boolean {
    if (!visitDetails) {
      console.log("Visit details validation failed: no visitDetails object");
      return false;
    }

    const validationChecks = {
      // Always required fields - only those that are actually visible in the current form

      // 1. Travel Information (always visible)
      visitingOtherSchengenCountries: !!(
        visitDetails.visitingOtherSchengenCountries &&
        Array.isArray(visitDetails.visitingOtherSchengenCountries) &&
        visitDetails.visitingOtherSchengenCountries.length > 0
      ),
      firstCountryOfEntry: !!visitDetails.firstCountryOfEntry,

      // 2. Visa History (always visible)
      hasSchengenVisa: !!visitDetails.hasSchengenVisa,
      hasDigitalFingerprints: !!visitDetails.hasDigitalFingerprints,

      // 3. Personal Information (always visible)
      maritalStatus: !!visitDetails.maritalStatus,

      // 4. Employment Information (always visible)
      employmentStatus: !!visitDetails.employmentStatus,

      // 5. Payment Information (always visible)
      willAnyonePayForVisit: !!visitDetails.willAnyonePayForVisit,
    };

    // Check conditional validations

    // Conditional: Schengen visa dates (only required if hasSchengenVisa = "Yes")
    if (visitDetails.hasSchengenVisa === "Yes") {
      validationChecks["lastVisaStartDate"] = !!visitDetails.lastVisaStartDate;
      validationChecks["lastVisaEndDate"] = !!visitDetails.lastVisaEndDate;
    }

    // Conditional: Previous visa number (only required if hasDigitalFingerprints = "Yes")
    if (visitDetails.hasDigitalFingerprints === "Yes") {
      validationChecks["previousVisaNumber"] = !!(
        visitDetails.previousVisaNumber &&
        visitDetails.previousVisaNumber.trim()
      );
    }

    // Conditional: Partner information (only required if maritalStatus = "Married")
    if (visitDetails.maritalStatus === "Married") {
      validationChecks["partnerFullName"] = !!(
        visitDetails.partnerFullName && visitDetails.partnerFullName.trim()
      );
      validationChecks["partnerDateOfBirth"] =
        !!visitDetails.partnerDateOfBirth;
    }

    // Conditional: Student information (only required if employmentStatus = "Student")
    if (visitDetails.employmentStatus === "Student") {
      validationChecks["institutionName"] = !!(
        visitDetails.institutionName && visitDetails.institutionName.trim()
      );
      validationChecks["instituteEmail"] = !!(
        visitDetails.instituteEmail && visitDetails.instituteEmail.trim()
      );
      validationChecks["instituteAddress"] = !!(
        visitDetails.instituteAddress && visitDetails.instituteAddress.trim()
      );
    }

    // Conditional: Employer information (only required if employmentStatus = "Employed")
    if (visitDetails.employmentStatus === "Employed") {
      validationChecks["employerPhone"] = !!(
        visitDetails.employerPhone && visitDetails.employerPhone.trim()
      );
      validationChecks["employerName"] = !!(
        visitDetails.employerName && visitDetails.employerName.trim()
      );
      validationChecks["employerEmail"] = !!(
        visitDetails.employerEmail && visitDetails.employerEmail.trim()
      );
      validationChecks["employerAddress"] = !!(
        visitDetails.employerAddress && visitDetails.employerAddress.trim()
      );
    }

    // Conditional: Other employment status (only required if employmentStatus = "Other")
    if (visitDetails.employmentStatus === "Other") {
      validationChecks["otherEmploymentStatus"] = !!(
        visitDetails.otherEmploymentStatus &&
        visitDetails.otherEmploymentStatus.trim()
      );
    }

    // Conditional: Funding information (only required if willAnyonePayForVisit = "Yes")
    if (visitDetails.willAnyonePayForVisit === "Yes") {
      validationChecks["fundingPersonName"] = !!(
        visitDetails.fundingPersonName && visitDetails.fundingPersonName.trim()
      );
      validationChecks["tripFundedBy"] = !!visitDetails.tripFundedBy;
    }

    const isComplete = Object.values(validationChecks).every(
      (check) => check === true
    );

    console.log("Visit details validation checks:", validationChecks);
    console.log("Visit details validation result:", isComplete);
    console.log("Visit details data:", JSON.stringify(visitDetails, null, 2));

    return isComplete;
  }

  private isDocumentsComplete(documents: any): boolean {
    if (!documents || !documents.documents) return false;

    const requiredDocIds = [1, 2, 5]; // Based on the frontend validation
    return requiredDocIds.every((id) => documents.documents[id]);
  }

  private isInsuranceComplete(insurance: any): boolean {
    if (!insurance) return false;

    if (
      insurance.insuranceCertificate !== null &&
      insurance.insuranceCertificate !== undefined
    ) {
      return true;
    }

    const insuranceValue = insurance.insurance;

    if (insuranceValue === "own") {
      // Own insurance is complete if the insuranceDetails flag indicates certificate uploaded
      const hasDetailsFlag = !!insurance.insuranceDetails?.certificateUploaded;
      return hasDetailsFlag;
    }

    return false;
  }

  // Helper method to check if all travelers have completed their steps
  private areAllTravelersCompleted(
    travelersData: any[],
    application: VisaApplication
  ): boolean {
    if (!travelersData || travelersData.length === 0) {
      return false;
    }

    return travelersData.every((traveler) => {
      const travelerStepInfo =
        traveler.stepInfo ||
        this.getTravelerStepInformation(traveler, application);
      return travelerStepInfo.isCompleted;
    });
  }

  // Helper method to check if any traveler has incomplete steps and update application status
  private checkAndUpdateApplicationStatusForIncompleteTravelers(
    travelersData: any[],
    application: VisaApplication
  ): void {
    if (!travelersData || travelersData.length === 0) {
      return;
    }

    // Check if number of travelers exceeds what was originally paid for
    const paidTravelerCount = application.numberOfTravellers || 1;
    const currentTravelerCount = travelersData.length;

    console.log(
      `Payment validation: Paid for ${paidTravelerCount} travelers, current count: ${currentTravelerCount}`
    );

    // If current travelers exceed paid amount, they need to handle their own insurance
    if (currentTravelerCount > paidTravelerCount) {
      const additionalTravelersCount = currentTravelerCount - paidTravelerCount;
      console.log(
        `Additional travelers detected: ${additionalTravelersCount}. Each must handle their own insurance.`
      );

      // Mark application as requiring additional payment/insurance
      if (application.applicationStatus === "submitted") {
        application.applicationStatus = "payment_required";
        console.log(
          "Application status changed to payment_required due to additional travelers"
        );
      }
    }

    // Check if any traveler has incomplete steps
    const hasIncompleteTravelers = travelersData.some((traveler, index) => {
      const travelerStepInfo =
        traveler.stepInfo ||
        this.getTravelerStepInformation(traveler, application);

      const isAdditionalTraveler = index >= paidTravelerCount;

      // For additional travelers, ensure they handle their own insurance
      if (isAdditionalTraveler) {
        console.log(
          `Checking additional traveler ${index + 1}: must handle own insurance`
        );

        // Check if traveler has their own insurance
        const travelerHasInsurance =
          traveler.insurance &&
          traveler.insurance.insurance &&
          traveler.insurance.insurance !== "false";

        if (!travelerHasInsurance) {
          // Additional traveler needs to complete insurance step
          const hasCompletedInsurance =
            travelerStepInfo.completedSteps.includes(
              VisaApplicationStepType.INSURANCE
            );
          if (!hasCompletedInsurance) {
            console.log(
              `Additional traveler ${index + 1} still needs to complete insurance`
            );
            return true; // Mark as incomplete if insurance not done
          }
        }
      }

      // For initial travelers, check insurance with backward compatibility
      else {
        // Check traveler-level insurance first
        const travelerHasInsurance =
          traveler.insurance &&
          traveler.insurance.insurance &&
          traveler.insurance.insurance !== "false";

        // For backward compatibility: if traveler doesn't have insurance but application has insurance, consider it valid
        const hasBackwardCompatibilityInsurance =
          !travelerHasInsurance &&
          application.insurance &&
          application.insurance !== "false";

        const effectivelyHasInsurance =
          travelerHasInsurance || hasBackwardCompatibilityInsurance;

        if (!effectivelyHasInsurance) {
          const hasCompletedInsurance =
            travelerStepInfo.completedSteps.includes(
              VisaApplicationStepType.INSURANCE
            );
          if (!hasCompletedInsurance) {
            console.log(
              `Traveler ${index + 1} still needs to complete insurance`
            );
            return true;
          }
        }
      }

      return !travelerStepInfo.isCompleted;
    });

    // If there are incomplete travelers and application was previously submitted, change status to "new"
    if (
      hasIncompleteTravelers &&
      application.applicationStatus === "submitted"
    ) {
      application.applicationStatus = "new";
      console.log(
        "Found incomplete travelers - changing application status from submitted to new"
      );
    }
    // If all travelers are completed, update to submitted
    else if (
      !hasIncompleteTravelers &&
      application.applicationStatus !== "submitted" &&
      application.applicationStatus !== "payment_required"
    ) {
      application.applicationStatus = "submitted";
      console.log(
        "All travelers completed - updating application status to submitted"
      );
    }
  }

  // Helper method to recalculate all travelers' step completion
  private recalculateAllTravelersSteps(
    travelersData: any[],
    application: VisaApplication
  ): void {
    const paidTravelerCount = application.numberOfTravellers || 1;

    travelersData.forEach((traveler, index) => {
      const isAdditionalTraveler = index >= paidTravelerCount;

      if (isAdditionalTraveler) {
        console.log(
          `Processing additional traveler ${index + 1} (beyond paid count of ${paidTravelerCount})`
        );
      }

      // Get current stepInfo or create default
      const currentStepInfo =
        traveler.stepInfo ||
        this.getTravelerStepInformation(traveler, application);

      // Recalculate completed steps based on actual data
      const calculatedCompletedSteps =
        this.calculateCompletedStepsFromData(traveler);

      // Merge existing completed steps with calculated ones
      const existingSteps = currentStepInfo.completedSteps || [];
      const allCompletedSteps = [
        ...new Set([...existingSteps, ...calculatedCompletedSteps]),
      ];

      // Determine steps configuration
      const allSteps = [
        VisaApplicationStepType.CREATE_APPLICATION,
        VisaApplicationStepType.BASIC_DETAILS,
        VisaApplicationStepType.VISIT_DETAILS,
        VisaApplicationStepType.DOCUMENTS,
        VisaApplicationStepType.APPOINTMENT, // Add appointment step
        VisaApplicationStepType.PAYMENT, // Add payment step
      ];

      // Check if this traveler has insurance at traveler level
      const travelerHasInsurance =
        traveler.insurance &&
        traveler.insurance.insurance &&
        traveler.insurance.insurance !== "false";

      // For backward compatibility: if traveler doesn't have insurance but application has insurance, consider it valid
      const hasBackwardCompatibilityInsurance =
        !travelerHasInsurance &&
        application.insurance &&
        application.insurance !== "false";

      const effectivelyHasInsurance =
        travelerHasInsurance || hasBackwardCompatibilityInsurance;

      // All travelers need insurance step if they don't have insurance (either at traveler level or backward compatibility)
      const needsInsuranceStep = !effectivelyHasInsurance;

      if (needsInsuranceStep) {
        if (!allSteps.includes(VisaApplicationStepType.INSURANCE)) {
          allSteps.push(VisaApplicationStepType.INSURANCE);
        }
      }

      // Find next step
      let nextStep = null;
      for (const step of allSteps) {
        if (!allCompletedSteps.includes(step)) {
          nextStep = step;
          break;
        }
      }

      // Determine completion status based on insurance handling
      let isCompleted = false;

      if (needsInsuranceStep) {
        // If insurance step is required, traveler must complete it
        isCompleted = allCompletedSteps.includes(
          VisaApplicationStepType.INSURANCE
        );
      } else {
        // If insurance is already handled (traveler level or backward compatibility),
        // traveler must complete documents, appointment, AND payment steps
        isCompleted =
          allCompletedSteps.includes(VisaApplicationStepType.DOCUMENTS) &&
          allCompletedSteps.includes(VisaApplicationStepType.APPOINTMENT) &&
          allCompletedSteps.includes(VisaApplicationStepType.PAYMENT);
      }

      // Update stepInfo with calculated values (no more redundant fields)
      currentStepInfo.completedSteps = allCompletedSteps;
      currentStepInfo.currentStep = nextStep || currentStepInfo.currentStep;
      currentStepInfo.nextStep = nextStep;
      currentStepInfo.isCompleted = isCompleted;
      currentStepInfo.stepProgress =
        (allCompletedSteps.length / allSteps.length) * 100;
      currentStepInfo.isAdditionalTraveler = isAdditionalTraveler;
      currentStepInfo.requiresInsurance = needsInsuranceStep;
      currentStepInfo.hasInsurance = effectivelyHasInsurance;

      // Remove redundant fields from traveler and store only stepInfo
      delete traveler.currentStep;
      delete traveler.completedSteps;
      delete traveler.completed;

      // Store updated stepInfo in traveler
      traveler.stepInfo = currentStepInfo;

      console.log(
        `Recalculated stepInfo for traveler ${traveler.id}:`,
        currentStepInfo
      );
    });

    // Check for payment requirements due to additional travelers
    const currentTravelerCount = travelersData.length;
    if (currentTravelerCount > paidTravelerCount) {
      console.log(
        `Additional travelers detected: ${currentTravelerCount - paidTravelerCount}`
      );
      if (application.applicationStatus === "submitted") {
        application.applicationStatus = "payment_required";
        console.log(
          "Application status updated to payment_required due to additional travelers"
        );
      }
    }

    // After recalculating all travelers, check if all are completed and update application status
    if (this.areAllTravelersCompleted(travelersData, application)) {
      if (
        application.applicationStatus !== "submitted" &&
        application.applicationStatus !== "payment_required"
      ) {
        application.applicationStatus = "submitted";
        console.log(
          "All travelers completed during recalculation - updating application status to submitted"
        );
      }
    } else {
      // If any traveler is incomplete and application was submitted, change to new
      if (application.applicationStatus === "submitted") {
        application.applicationStatus = "new";
        console.log(
          "Found incomplete travelers during recalculation - changing application status to new"
        );
      }
    }
  }

  // Helper method to check if any additional travelers need insurance payment
  private checkForUnpaidAdditionalTravelers(
    travelersData: any[],
    application: VisaApplication
  ): boolean {
    if (!travelersData || !Array.isArray(travelersData)) {
      return false;
    }

    const paidTravelerCount = application.numberOfTravellers || 1;

    // Check if any additional travelers (beyond paid count) require insurance payment
    for (let i = paidTravelerCount; i < travelersData.length; i++) {
      const traveler = travelersData[i];
      const stepInfo = this.getTravelerStepInformation(traveler, application);

      // If this additional traveler requires insurance and hasn't paid yet
      if (stepInfo.requiresInsurance && !stepInfo.hasInsurance) {
        console.log(`Additional traveler ${i + 1} requires insurance payment`);
        return true;
      }
    }

    return false;
  }
}
