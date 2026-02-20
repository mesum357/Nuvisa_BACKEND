import { Injectable } from "@nestjs/common";
import { VisaApplication } from "./visa-application.entity";
// import { VisaApplicationDto, VisaApplicationStepType } from "./dto/visa-application.dto";
import { callHTTPException } from "src/shared/exceptions";
import {
  GetApplicationByIdDto,
  VisaApplicationDeleteDto,
  VisaApplicationDto,
  VisaApplicationStepType,
  VisaApplicationUpdateDto,
} from "./dto/visa-application.dto";
import { User } from "src/auth/auth.entity";

function filterSensitiveDataForLogging(data: any): any {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => filterSensitiveDataForLogging(item));
  }

  if (typeof data === "object") {
    const filtered = { ...data };

    if (filtered.passportFront) {
      filtered.passportFront = "[BASE64_IMAGE_DATA_REMOVED]";
    }
    if (filtered.passportBack) {
      filtered.passportBack = "[BASE64_IMAGE_DATA_REMOVED]";
    }
    if (filtered.insuranceCertificate) {
      filtered.insuranceCertificate = "[BASE64_IMAGE_DATA_REMOVED]";
    }

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
  async checkIfUserExists(id): Promise<User | null> {
    try {
      console.log('checkIfUserExists called with id:', id);
      const user = await User.findByPk(id);
      console.log('User found:', user ? { id: user.id, email: user.email } : 'null');
      return user;
    } catch (error) {
      console.error('Error in checkIfUserExists:', error);
      return null;
    }
  }

  async getUserVisaApplications(userId) {
    try {
      console.log('getUserVisaApplications called with userId:', userId);
      
      const user = await this.checkIfUserExists(userId);
      console.log('Found user:', user ? { id: user.id, email: user.email } : 'null');

      if (!user) {
        console.log('User not found in database, returning empty applications...');
        return { applications: [] }; // Return empty array if user doesn't exist
      }

      const userVisaApplications = await VisaApplication.findAll({
        where: { email: user.email },
      });
      
      console.log('Found applications count:', userVisaApplications.length);

      const applicationsWithParsedData = userVisaApplications.map((app) => {
        let parsedTravelersData = null;

        if (app.travelersData) {
          try {
            parsedTravelersData = JSON.parse(app.travelersData);
          } catch {
            parsedTravelersData = null;
          }
        }

        if (!parsedTravelersData && app.numberOfTravellers) {
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
                insurance: "false", // Default to false for backward compatibility
                insuranceDetails: null,
                orderId: null,
                paymentAmount: null,
                insurancePaymentCompleted: false,
              },
              fullPayment: {
                paymentStatus: "pending",
                paymentMethod: "",
                orderId: null,
                paymentAmount: null,
                paymentCompleted: false,
                includeInsurance: false,
                insuranceType: "none",
              },
            })
          );

          app.travelersData = JSON.stringify(parsedTravelersData);
          app.save().catch((_error) => {
            console.error(
              `Failed to save initialized travelersData for app ${app.id}:`,
              _error
            );
          });
        }

        if (Array.isArray(parsedTravelersData)) {
          parsedTravelersData = parsedTravelersData.map((traveler) => {
            const travelerStepInfo = this.getTravelerStepInformation(
              traveler,
              app
            );

            const {
              currentStep: _currentStep,
              completedSteps: _completedSteps,
              completed: _completed,
              ...cleanTravelerData
            } = traveler;

            return {
              ...cleanTravelerData,
              stepInfo: travelerStepInfo,
            };
          });
        }

        const appJson = app.toJSON();
        const {
          currentStep: _currentStep,
          completedSteps: _completedSteps,
          stepProgress: _stepProgress,
          stepData: _stepData,
          ...appWithoutRedundantFields
        } = appJson;

        let orderId = appWithoutRedundantFields.orderId || null;
        try {
          if (
            !orderId &&
            Array.isArray(parsedTravelersData) &&
            parsedTravelersData.length > 0
          ) {
            const firstTraveler = parsedTravelersData[0];
            if (
              firstTraveler &&
              firstTraveler.insurance &&
              firstTraveler.insurance.orderId
            ) {
              orderId = firstTraveler.insurance.orderId;
            }
          }
        } catch {}

        return {
          ...appWithoutRedundantFields,
          orderId,
          travelersData: parsedTravelersData,
          stepInfo: this.getStepInformation(app),
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
      // console.log(id, "TEMPPP");

      const userVisaApplication = await VisaApplication.findByPk(id);

      if (!userVisaApplication) {
        callHTTPException("Visa application not found");
      }

      // console.log(userVisaApplication, "TEMPPPPPPP");
      let parsedTravelersData = null;

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

      // if (!parsedTravelersData && userVisaApplication.numberOfTravellers) {
      //   parsedTravelersData = Array.from(
      //     { length: userVisaApplication.numberOfTravellers },
      //     (_, index) => ({
      //       id: index + 1,
      //       basicDetails: {
      //         passportNumber: "",
      //         firstName: "",
      //         lastName: "",
      //         sex: "",
      //         dateOfBirth: "",
      //         placeOfBirth: "",
      //         passportIssuePlace: "",
      //         passportIssueDate: "",
      //         passportExpiryDate: "",
      //         currentAddress1: "",
      //         currentAddress2: "",
      //         state: "",
      //         city: "",
      //         pincode: "",
      //         mobileNumber: "",
      //         passportFront: null,
      //         passportBack: null,
      //       },
      //       visitDetails: {
      //         visitingOtherSchengenCountries: [],
      //         firstCountryOfEntry: "",
      //         hasSchengenVisa: "",
      //         lastVisaStartDate: "",
      //         lastVisaEndDate: "",
      //         hasDigitalFingerprints: "",
      //         previousVisaNumber: "",
      //         maritalStatus: "",
      //         partnerFullName: "",
      //         partnerDateOfBirth: "",
      //         employmentStatus: "",
      //         institutionName: "",
      //         instituteEmail: "",
      //         instituteAddress: "",
      //         employerPhone: "",
      //         employerName: "",
      //         employerEmail: "",
      //         employerAddress: "",
      //         otherEmploymentStatus: "",
      //         willAnyonePayForVisit: "",
      //         fundingPersonName: "",
      //         tripFundedBy: "",
      //       },
      //       documents: {
      //         documents: {},
      //       },
      //       insurance: {
      //         insurance: "false", // Default to false for backward compatibility
      //         insuranceDetails: null,
      //         orderId: null,
      //         paymentAmount: null,
      //         insurancePaymentCompleted: false,
      //       },
      //       fullPayment: {
      //         paymentStatus: "pending",
      //         paymentMethod: "",
      //         orderId: null,
      //         paymentAmount: null,
      //         paymentCompleted: false,
      //         includeInsurance: false,
      //         insuranceType: "none",
      //       },
      //     })
      //   );

      //   userVisaApplication.travelersData = JSON.stringify(parsedTravelersData);
      //   await userVisaApplication.save();
      // }

      // console.log(parsedTravelersData, "TEMPPP");

      if (Array.isArray(parsedTravelersData)) {
        parsedTravelersData = parsedTravelersData.map((traveler) => {
          const travelerStepInfo = this.getTravelerStepInformation(
            traveler,
            userVisaApplication
          );

          const {
            currentStep: _currentStep,
            completedSteps: _completedSteps,
            completed: _completed,
            ...cleanTravelerData
          } = traveler;

          return {
            ...cleanTravelerData,
            stepInfo: travelerStepInfo,
          };
        });
      }

      const applicationJson = userVisaApplication.toJSON();
      const {
        currentStep: _currentStep,
        completedSteps: _completedSteps,
        stepProgress: _stepProgress,
        stepData: _stepData,
        ...applicationWithoutRedundantFields
      } = applicationJson;
      const applicationWithParsedData = {
        ...applicationWithoutRedundantFields,
        travelersData: parsedTravelersData,
        stepInfo: this.getStepInformation(userVisaApplication),
        // include top-level insurance if present on the model instance or JSON
        insurance:
          (userVisaApplication as any)?.toJSON?.()?.insurance ||
          (userVisaApplication as any).insurance ||
          null,
      };

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
        // Idempotency guard: if an application with this stripePaymentId already exists
        // (e.g. the Stripe webhook already created it), return that application instead of
        // inserting a duplicate and hitting the unique constraint.
        if (dto.stripePaymentId) {
          const existing = await VisaApplication.findOne({
            where: { stripePaymentId: dto.stripePaymentId },
          });
          if (existing) {
            console.log(`[createOrUpdateApplication] Returning existing application for stripePaymentId=${dto.stripePaymentId}, id=${existing.id}`);
            return { application: existing };
          }
        }

        let processedTravelersData = dto.travelersData;

        if (!processedTravelersData) {
          const numberOfTravelers = dto.numberOfTravellers || 1;
          processedTravelersData = [];

          for (let i = 1; i <= numberOfTravelers; i++) {
            const uniqueId = `traveler_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            processedTravelersData.push({
              id: uniqueId,
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
                insurance: false,
                insuranceDetails: null,
                insuranceCertificate: null,
                orderId: null,
                paymentAmount: null,
                insurancePaymentCompleted: false,
              },
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
              fullPayment: {
                paymentStatus: "pending",
                paymentMethod: "",
                orderId: null,
                paymentAmount: null,
                paymentCompleted: false,
                includeInsurance: false,
                insuranceType: "none",
              },
            });
          }
        }

        // if (dto.travelersData) {
        //   processedTravelersData = dto.travelersData.map((traveler, index) => {
        //     const numberOfPaidTravelers = dto.numberOfTravellers || 1;
        //     if (index < numberOfPaidTravelers) {
        //       return {
        //         ...traveler,
        //         insurance: {
        //           ...traveler.insurance,
        //           insurance: dto.insurance,
        //         },
        //       };
        //     }
        //     return {
        //       ...traveler,
        //       insurance: {
        //         ...traveler.insurance,
        //         insurance: false,
        //         insuranceDetails: null,
        //       },
        //     };
        //   });
        // }

        application = await VisaApplication.create({
          email: dto.email,
          country: dto.country,
          visaTypeId: dto.visaTypeId,
          selectedVisaType: dto.selectedVisaType, // Store complete selected visa type object
          orderId: dto.orderId, // Store SMV Konveyor order ID
          stripePaymentId: dto.stripePaymentId || null, // Idempotency key — unique per payment
          amountPaid: dto.amountPaid,
          amountPaidTotal: dto.amountPaidTotal || dto.amountPaid, // Total amount paid for all travelers
          paymentWithoutInsurance: String(dto.paymentWithoutInsurance || 0),
          initialInsurancePaidTotal:
            dto.initialInsurancePaidTotal ||
            String(
              (processedTravelersData || [])
                .map(
                  (t) => Number(((t || {}).insurance || {}).paymentAmount) || 0
                )
                .reduce((s, v) => s + v, 0)
            ), // Total insurance paid initially
          applicationStatus: "new",
          currentStep: VisaApplicationStepType.BASIC_DETAILS, // Set to next step immediately
          completedSteps: [VisaApplicationStepType.CREATE_APPLICATION],
          stepProgress: 25,
          numberOfTravellers: dto.numberOfTravellers || 1,
          initiallyPaidTraveler:
            dto.initiallyPaidTraveler || dto.numberOfTravellers || 1, // Number of travelers initially paid for
          totalTraveler: dto.totalTraveler || dto.numberOfTravellers || 1, // Total number of travelers
          travelersData: processedTravelersData
            ? JSON.stringify(processedTravelersData)
            : null,
          // Create a top-level application insurance object derived from traveler insurance if available
          insurance: dto.insurance ? JSON.stringify(dto.insurance) : null,
          paymentStatus: dto.paymentStatus || "pending",
          paymentMethod: dto.paymentMethod || "",
          insuranceDetails: dto.insuranceDetails || null,
          travelStartDate: dto.travelStartDate || null,
          travelEndDate: dto.travelEndDate || null,
        });
      } else {
        if (!dto.applicationId) {
          callHTTPException("applicationId is required for this step");
        }

        application = await VisaApplication.findByPk(dto.applicationId);
        if (!application) {
          callHTTPException("Visa application not found");
        }

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

          const currentStepInfo = this.getTravelerStepInformation(
            currentTraveler,
            application
          );

          if (!currentStepInfo.completedSteps.includes(dto.type)) {
            currentStepInfo.completedSteps.push(dto.type);
          }

          const calculatedCompletedSteps =
            this.calculateCompletedStepsFromData(currentTraveler);

          const manualSteps = currentStepInfo.completedSteps;

          const allCompletedSteps = [...manualSteps];
          calculatedCompletedSteps.forEach((step) => {
            if (!allCompletedSteps.includes(step)) {
              allCompletedSteps.push(step);
            }
          });

          if (!allCompletedSteps.includes(dto.type)) {
            allCompletedSteps.push(dto.type);
          }

          currentStepInfo.completedSteps = allCompletedSteps;

          const allSteps = [
            VisaApplicationStepType.CREATE_APPLICATION,
            VisaApplicationStepType.BASIC_DETAILS,
            VisaApplicationStepType.VISIT_DETAILS,
            VisaApplicationStepType.DOCUMENTS,
            VisaApplicationStepType.APPOINTMENT,
            VisaApplicationStepType.INSURANCE,
          ];

          if (!allSteps.includes(VisaApplicationStepType.INSURANCE)) {
            allSteps.push(VisaApplicationStepType.INSURANCE);
          }

          let travelerNextStep = null;
          for (const step of allSteps) {
            if (!allCompletedSteps.includes(step)) {
              travelerNextStep = step;
              break;
            }
          }

          currentStepInfo.currentStep =
            travelerNextStep || currentStepInfo.currentStep;
          currentStepInfo.nextStep = travelerNextStep;
          currentStepInfo.isCompleted = travelerNextStep === null;
          currentStepInfo.stepProgress =
            (allCompletedSteps.length / allSteps.length) * 100;

          currentTraveler.stepInfo = currentStepInfo;

          const updatedTravelersData = dto.travelersData || travelersData;
        }

        // No more global step tracking - only traveler-specific stepInfo is managed

        if (dto.type === VisaApplicationStepType.BASIC_DETAILS) {
          const _dtoForLogging = filterSensitiveDataForLogging(dto);
          const incomingBasic = (dto as any).basicDetails;
          if (incomingBasic && typeof dto.currentTravelerIndex === "number") {
            try {
              if (travelersData[dto.currentTravelerIndex]) {
                travelersData[dto.currentTravelerIndex].basicDetails = {
                  ...travelersData[dto.currentTravelerIndex].basicDetails,
                  ...incomingBasic,
                };
              }
            } catch (err) {
              console.error("Error while merging basicDetails:", err);
            }
          }

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

          if (dto.numberOfTravellers) {
            application.numberOfTravellers = dto.numberOfTravellers;
          }
        }

        if (dto.type === VisaApplicationStepType.VISIT_DETAILS) {
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
          // Handle appointment step - merge incoming appointment data into the current traveler
          const incomingAppointment = dto.appointment;
          application.appointment = dto.appointment || null;

          if (incomingAppointment && dto.currentTravelerIndex !== undefined) {
            try {
              if (travelersData[dto.currentTravelerIndex]) {
                travelersData[dto.currentTravelerIndex].appointment = {
                  ...travelersData[dto.currentTravelerIndex].appointment,
                  ...incomingAppointment,
                };
              }
            } catch (err) {
              console.error("Error while merging appointment:", err);
            }
          } else {
          }

          // Use updated travelers data or merge with existing data
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

          const currentTravelersData = dto.travelersData || travelersData;
          if (
            this.areAllTravelersCompleted(currentTravelersData, application)
          ) {
          }
        }

        if (dto.type === VisaApplicationStepType.DOCUMENTS) {
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

          const currentTravelersData = dto.travelersData || travelersData;
          if (
            this.areAllTravelersCompleted(currentTravelersData, application)
          ) {
          }
        }

        if (dto.type === VisaApplicationStepType.INSURANCE) {
          // Handle traveler-specific insurance payments (when paymentType indicates traveler insurance)
          if (
            dto.paymentType === "additional_traveler_insurance" ||
            dto.paymentType === "traveler_insurance"
          ) {
            const addAmount = Number(dto.amountPaid) || 0;

            if (
              dto.currentTravelerIndex !== undefined &&
              travelersData[dto.currentTravelerIndex]
            ) {
              const currentTraveler = travelersData[dto.currentTravelerIndex];

              if (!currentTraveler.insurance) {
                currentTraveler.insurance = {};
              }

              if (dto.insurancePaymentCompleted === true) {
                currentTraveler.insurance.insurance = "true"; // Insurance paid and active
                currentTraveler.insurance.insurancePaymentCompleted = true;

                if (dto.orderId) {
                  currentTraveler.insurance.orderId = dto.orderId;
                }
                if (dto.paymentDate) {
                  currentTraveler.insurance.paymentDate = dto.paymentDate;
                }
                if (dto.amountPaid) {
                  currentTraveler.insurance.paymentAmount = Number(
                    dto.amountPaid
                  );
                }

                if ((dto as any).paymentSource) {
                  currentTraveler.insurance.paymentSource = (
                    dto as any
                  ).paymentSource;
                }

                currentTraveler.insurance.insuranceDetails = {
                  selected: true,
                  paid: true,
                  paymentType: dto.paymentType,
                };

                if (
                  dto.insuranceCertificates &&
                  Array.isArray(dto.insuranceCertificates)
                ) {
                  currentTraveler.insurance.insuranceCertificates =
                    dto.insuranceCertificates;
                  application.insuranceCertificates = dto.insuranceCertificates;
                }
              }

              application.travelersData = JSON.stringify(travelersData);
              // Update application-level totals
              application.amountPaid = String(
                Number(application.amountPaid || 0) + addAmount
              );
              application.initialInsurancePaidTotal = String(
                (JSON.parse(application.travelersData || "[]") as any[])
                  .map(
                    (t) =>
                      Number(((t || {}).insurance || {}).paymentAmount) || 0
                  )
                  .reduce((s, v) => s + v, 0)
              );

              try {
                const parsedAppTrav = JSON.parse(
                  application.travelersData || "[]"
                );
                const totalInsurance = parsedAppTrav
                  .map(
                    (t: any) =>
                      Number(((t || {}).insurance || {}).paymentAmount) || 0
                  )
                  .reduce((s: number, v: number) => s + v, 0);
                const allPaid = parsedAppTrav.every(
                  (t: any) =>
                    (t.insurance && t.insurance.insurancePaymentCompleted) ===
                    true
                );
                const anyOrder =
                  parsedAppTrav.find(
                    (t: any) => t.insurance && t.insurance.orderId
                  )?.insurance?.orderId || null;
                const anyPaymentSource =
                  parsedAppTrav.find(
                    (t: any) => t.insurance && t.insurance.paymentSource
                  )?.insurance?.paymentSource ||
                  (dto as any).paymentSource ||
                  null;
                (application as any).insurance = {
                  insurancePaymentCompleted: allPaid,
                  orderId: anyOrder,
                  paymentAmount: totalInsurance,
                  insuranceCertificates:
                    application.insuranceCertificates || null,
                  paymentSource: anyPaymentSource,
                };
              } catch {
                // ignore
              }

              this.recalculateAllTravelersSteps(travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                travelersData,
                application
              );
            }
          } else {
            // Handle the cases where DTO includes travelersData or certificates updates
            if (dto.travelersData && Array.isArray(dto.travelersData)) {
              const incoming = dto.travelersData.map((t: any) => {
                return {
                  ...t,
                  insurance: {
                    ...t.insurance,
                    insuranceCertificates:
                      t.insuranceCertificates ||
                      (t.insurance && t.insurance.insuranceCertificates) ||
                      null,
                  },
                };
              });

              application.travelersData = JSON.stringify(incoming);

              // If application-level insuranceCertificates passed, persist them
              if (
                (dto as any).insuranceCertificates &&
                Array.isArray((dto as any).insuranceCertificates)
              ) {
                application.insuranceCertificates = (
                  dto as any
                ).insuranceCertificates;
              }

              // Sync top-level application.insurance from incoming travelers
              try {
                const parsedIncoming = JSON.parse(
                  application.travelersData || "[]"
                );
                const totalInsurance = parsedIncoming
                  .map(
                    (t: any) =>
                      Number(((t || {}).insurance || {}).paymentAmount) || 0
                  )
                  .reduce((s: number, v: number) => s + v, 0);
                const allPaid = parsedIncoming.every(
                  (t: any) =>
                    (t.insurance && t.insurance.insurancePaymentCompleted) ===
                    true
                );
                const anyOrder =
                  parsedIncoming.find(
                    (t: any) => t.insurance && t.insurance.orderId
                  )?.insurance?.orderId || null;
                const anyPaymentSource =
                  parsedIncoming.find(
                    (t: any) => t.insurance && t.insurance.paymentSource
                  )?.insurance?.paymentSource ||
                  (dto as any).paymentSource ||
                  null;
                (application as any).insurance = {
                  insurancePaymentCompleted: allPaid,
                  orderId: anyOrder,
                  paymentAmount: totalInsurance,
                  insuranceCertificates:
                    application.insuranceCertificates || null,
                  paymentSource: anyPaymentSource,
                };
              } catch {
                // ignore
              }

              this.recalculateAllTravelersSteps(incoming, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                incoming,
                application
              );
            } else if (travelersData.length > 0) {
              // Possible update for a specific traveler (e.g., toggling insurance selection)
              if (
                dto.currentTravelerIndex !== undefined &&
                travelersData[dto.currentTravelerIndex]
              ) {
                const currentTraveler = travelersData[dto.currentTravelerIndex];
                if (!currentTraveler.insurance) {
                  currentTraveler.insurance = {};
                }

                currentTraveler.insurance.insurance = dto.insurance || "false";

                if (dto.insuranceDetails) {
                  currentTraveler.insurance.insuranceDetails =
                    dto.insuranceDetails;
                }

                if (dto.insuranceCertificate) {
                  currentTraveler.insurance.insuranceCertificate =
                    dto.insuranceCertificate;
                }

                if (
                  dto.insuranceCertificates &&
                  Array.isArray(dto.insuranceCertificates)
                ) {
                  currentTraveler.insurance.insuranceCertificates =
                    dto.insuranceCertificates;
                  application.insuranceCertificates = dto.insuranceCertificates;
                }
              }

              application.travelersData = JSON.stringify(travelersData);
              this.recalculateAllTravelersSteps(travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                travelersData,
                application
              );
            }
          }

          // If DTO indicates application-level insurancePaymentCompleted, mark all travelers as paid and distribute amounts
          if (
            dto.insurancePaymentCompleted === true &&
            !dto.currentTravelerIndex
          ) {
            const addAmount = Number(dto.amountPaid) || 0;
            let parsed = [] as any[];
            try {
              parsed = application.travelersData
                ? JSON.parse(application.travelersData)
                : [];
            } catch {
              parsed = travelersData;
            }

            // Compute per-traveler expected cost and set paymentAmount
            const perTravelerCosts = parsed.map((t) =>
              this.calculateInsuranceCost(t, application)
            );
            // Optionally distribute addAmount proportionally, but prefer expected cost
            parsed = parsed.map((t, idx) => {
              if (!t.insurance) t.insurance = {};
              t.insurance.insurance = "true";
              t.insurance.insurancePaymentCompleted = true;
              t.insurance.paymentAmount = perTravelerCosts[idx];
              if (
                (dto as any).insuranceCertificates &&
                Array.isArray((dto as any).insuranceCertificates)
              ) {
                t.insurance.insuranceCertificates = (
                  dto as any
                ).insuranceCertificates;
              }
              // persist payment source per traveler when provided
              if ((dto as any).paymentSource) {
                t.insurance.paymentSource = (dto as any).paymentSource;
              }
              return t;
            });

            application.travelersData = JSON.stringify(parsed);
            application.amountPaid = String(
              Number(application.amountPaid || 0) + addAmount
            );
            application.initialInsurancePaidTotal = String(
              parsed
                .map(
                  (t) => Number(((t || {}).insurance || {}).paymentAmount) || 0
                )
                .reduce((s, v) => s + v, 0)
            );

            if (
              (dto as any).insuranceCertificates &&
              Array.isArray((dto as any).insuranceCertificates)
            ) {
              application.insuranceCertificates = (
                dto as any
              ).insuranceCertificates;
            }

            // Sync top-level application.insurance for application-level payment
            try {
              const totalInsurance = parsed
                .map(
                  (t: any) =>
                    Number(((t || {}).insurance || {}).paymentAmount) || 0
                )
                .reduce((s: number, v: number) => s + v, 0);
              (application as any).insurance = {
                insurancePaymentCompleted: true,
                orderId: dto.orderId || null,
                paymentAmount: totalInsurance,
                insuranceCertificates:
                  (dto as any).insuranceCertificates ||
                  application.insuranceCertificates ||
                  null,
                paymentSource: (dto as any).paymentSource || null,
              };
            } catch {
              // ignore
            }
          }

          const currentTravelersData =
            dto.travelersData ||
            (application.travelersData
              ? JSON.parse(application.travelersData)
              : travelersData);
          if (
            this.areAllTravelersCompleted(currentTravelersData, application)
          ) {
          } else {
            const hasUnpaidAdditionalTravelers =
              this.checkForUnpaidAdditionalTravelers(
                currentTravelersData,
                application
              );
          }
        }

        if (dto.type === VisaApplicationStepType.FULL_PAYMENT) {
          // Handle full payment step - this combines payment processing with insurance selection
          if (dto.travelersData && Array.isArray(dto.travelersData)) {
            application.travelersData = JSON.stringify(dto.travelersData);
          } else if (
            dto.currentTravelerIndex !== undefined &&
            travelersData[dto.currentTravelerIndex]
          ) {
            const currentTraveler = travelersData[dto.currentTravelerIndex];

            // Initialize fullPayment object if it doesn't exist
            if (!currentTraveler.fullPayment) {
              currentTraveler.fullPayment = {};
            }

            // Handle payment completion
            if (
              dto.paymentStatus === "completed" ||
              dto.paymentStatus === "paid"
            ) {
              // Only treat this as a completed FULL_PAYMENT when the DTO explicitly
              // indicates a full payment (includeInsurance true, explicit isFullPayment flag,
              // or paymentType === 'full_payment'). This avoids marking FULL_PAYMENT
              // completed for insurance-only payments.
              const isExplicitFullPayment =
                (dto as any).includeInsurance === true ||
                (dto as any).isFullPayment === true ||
                (dto as any).paymentType === "full_payment";

              if (isExplicitFullPayment) {
                currentTraveler.fullPayment.paymentStatus = "completed";
                currentTraveler.fullPayment.paymentCompleted = true;
                currentTraveler.fullPayment.paymentDate =
                  dto.paymentDate || new Date().toISOString();
              } else {
                // Not a full payment — set only non-state-changing fields, do not mark completed
                currentTraveler.fullPayment.paymentDate =
                  dto.paymentDate ||
                  currentTraveler.fullPayment.paymentDate ||
                  new Date().toISOString();
              }

              if (dto.orderId) {
                currentTraveler.fullPayment.orderId = dto.orderId;
              }
              if (dto.amountPaid) {
                currentTraveler.fullPayment.paymentAmount = Number(
                  dto.amountPaid
                );
              }
              if (dto.paymentMethod) {
                currentTraveler.fullPayment.paymentMethod = dto.paymentMethod;
              }

              // Handle insurance selection within payment
              if (dto.insurance || (dto as any).includeInsurance) {
                currentTraveler.fullPayment.includeInsurance = true;
                currentTraveler.fullPayment.insuranceType =
                  (dto as any).insuranceType || "purchase";

                if ((dto as any).insuranceCertificate) {
                  currentTraveler.fullPayment.insuranceCertificate = (
                    dto as any
                  ).insuranceCertificate;
                }
                if ((dto as any).insuranceDetails) {
                  currentTraveler.fullPayment.insuranceDetails = (
                    dto as any
                  ).insuranceDetails;
                }
                if (
                  (dto as any).insuranceCertificates &&
                  Array.isArray((dto as any).insuranceCertificates)
                ) {
                  currentTraveler.fullPayment.insuranceCertificates = (
                    dto as any
                  ).insuranceCertificates;
                  if (!currentTraveler.insurance)
                    currentTraveler.insurance = {};
                  currentTraveler.insurance.insuranceCertificates = (
                    dto as any
                  ).insuranceCertificates;
                }
              }
            }

            application.travelersData = JSON.stringify(travelersData);
          }

          if (dto.fullPayment) {
            try {
              const currentFullPayment = application.fullPayment
                ? JSON.parse(application.fullPayment)
                : {};
              const updatedFullPayment = {
                ...currentFullPayment,
                ...dto.fullPayment,
              };
              application.fullPayment = JSON.stringify(updatedFullPayment);
            } catch (error) {
              console.error(
                "Error handling application-level fullPayment:",
                error
              );
            }
          }

          this.recalculateAllTravelersSteps(
            dto.travelersData || travelersData,
            application
          );
          this.checkAndUpdateApplicationStatusForIncompleteTravelers(
            dto.travelersData || travelersData,
            application
          );

          const currentTravelersData = dto.travelersData || travelersData;
          if (
            this.areAllTravelersCompleted(currentTravelersData, application)
          ) {
          }
        }

        if (dto.type === VisaApplicationStepType.PAYMENT) {
          const incomingPayment = (dto as any).payment;

          if (
            incomingPayment &&
            dto.currentTravelerIndex !== undefined &&
            travelersData[dto.currentTravelerIndex]
          ) {
            try {
              const currentTraveler = travelersData[dto.currentTravelerIndex];
              if (!currentTraveler.payment) currentTraveler.payment = {};

              currentTraveler.payment = {
                ...currentTraveler.payment,
                ...incomingPayment,
              };

              try {
                if (dto.insurance) {
                  if (!currentTraveler.insurance)
                    currentTraveler.insurance = {};
                  currentTraveler.insurance.insurance = dto.insurance;
                }

                if (dto.insuranceDetails) {
                  if (!currentTraveler.insurance)
                    currentTraveler.insurance = {};
                  currentTraveler.insurance.insuranceDetails = {
                    ...currentTraveler.insurance.insuranceDetails,
                    ...dto.insuranceDetails,
                  };
                }

                if (dto.orderId) {
                  if (!currentTraveler.insurance)
                    currentTraveler.insurance = {};
                  currentTraveler.insurance.orderId = dto.orderId;
                }

                if (dto.amountPaid !== undefined) {
                  if (!currentTraveler.insurance)
                    currentTraveler.insurance = {};
                  currentTraveler.insurance.paymentAmount = Number(
                    dto.amountPaid
                  );
                }

                if (
                  currentTraveler.insurance &&
                  currentTraveler.insurance.insurance === "purchase"
                ) {
                  const numericInsurancePaid =
                    Number(currentTraveler.insurance.paymentAmount) ||
                    Number(incomingPayment.amountPaid) ||
                    Number(incomingPayment.amount) ||
                    null;

                  if (numericInsurancePaid) {
                    currentTraveler.insurance.paymentAmount =
                      numericInsurancePaid;
                  }

                  const insuranceValid = this.validateInsurancePaymentAmount(
                    currentTraveler,
                    application
                  );

                  if (!insuranceValid) {
                    console.error(
                      `Insurance payment validation failed for traveler ${dto.currentTravelerIndex} during PAYMENT step`
                    );
                    callHTTPException("Insurance payment amount is invalid");
                  }
                }
              } catch (err) {
                console.error(
                  "Error validating insurance payment during PAYMENT step:",
                  err
                );
              }

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
                // Mirror into fullPayment for unified flow
                if (!currentTraveler.fullPayment)
                  currentTraveler.fullPayment = {};
                currentTraveler.fullPayment.paymentStatus = "completed";
                currentTraveler.fullPayment.paymentCompleted = true;
                currentTraveler.fullPayment.paymentDate =
                  currentTraveler.payment.paymentDate;
                currentTraveler.fullPayment.paymentAmount =
                  incomingPayment.amountPaid ||
                  currentTraveler.payment.amountPaid;
              } else if (status === "processing" || status === "pending") {
                currentTraveler.payment.paymentStatus = "processing";
              }

              application.travelersData = JSON.stringify(travelersData);
              this.recalculateAllTravelersSteps(travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                travelersData,
                application
              );

              // Do not auto-submit; explicit submit action required
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

            // Do not auto-submit; explicit submit action required
          }
        }

        await application.save();
      }

      let parsedTravelersData = null;
      if (application.travelersData) {
        try {
          parsedTravelersData = JSON.parse(application.travelersData);

          if (Array.isArray(parsedTravelersData)) {
            parsedTravelersData = parsedTravelersData.map(
              (traveler, _index) => {
                const travelerStepInfo = this.getTravelerStepInformation(
                  traveler,
                  application
                );

                const {
                  currentStep: _currentStep,
                  completedSteps: _completedSteps,
                  completed: _completed,
                  ...cleanTravelerData
                } = traveler;

                const finalTravelerData = {
                  ...cleanTravelerData,
                  stepInfo: travelerStepInfo,
                };

                return finalTravelerData;
              }
            );
          }
        } catch (error) {
          console.error("Error parsing travelersData:", error);
          parsedTravelersData = null;
        }
      }

      const applicationJson = application.toJSON();
      const {
        currentStep: _currentStep,
        completedSteps: _completedSteps,
        stepProgress: _stepProgress,
        stepData: _stepData,
        ...applicationWithoutRedundantFields
      } = applicationJson;

      const applicationWithParsedData = {
        ...applicationWithoutRedundantFields,
        travelersData: parsedTravelersData,
        stepInfo: this.getStepInformation(application),
        // include top-level insurance if present on the model instance or JSON
        insurance:
          (application as any)?.toJSON?.()?.insurance ||
          (application as any).insurance ||
          null,
        appointment: dto.appointment || null,
      };

      return {
        application: applicationWithParsedData,
      };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async updateVisaApplication(dto: VisaApplicationUpdateDto) {
    try {
      if (!dto || !dto.id) {
        callHTTPException("application id is required");
      }

      let application = await VisaApplication.findByPk(dto.id);

      if (!application) {
        callHTTPException("Visa application not found");
      }

      const updatableFields = [
        "userId",
        "visaType",
        "country",
        "numberOfTravellers",
        "amountPaid",
        "applicationStatus",
        "travelersData",
        "fullPayment",
        "initiallyPaidTraveler",
        "initialPaymentTotal",
        "initialInsurancePaidTotal",
        "paymentDueDate",
        "appointmentDate",
        "appointmentTime",
        "consulateLocation",
        "specialInstructions",
        "archivedAt",
        "insuranceCertificates",
        "totalTraveler",
        "travelStartDate",
        "travelEndDate",
        "insuranceDetails",
      ];

      updatableFields.forEach((field) => {
        if (dto[field] !== undefined) {
          if (field === "fullPayment") {
            try {
              const currentFullPayment = application.fullPayment
                ? JSON.parse(application.fullPayment)
                : {};
              const updatedFullPayment = {
                ...currentFullPayment,
                ...dto.fullPayment,
              };
              application.fullPayment = JSON.stringify(updatedFullPayment);
            } catch (error) {
              console.error("Error updating fullPayment field:", error);
            }
          } else if (field === "travelersData") {
            if (Array.isArray(dto.travelersData)) {
              application.travelersData = JSON.stringify(dto.travelersData);
            } else if (typeof dto.travelersData === "string") {
              application.travelersData = dto.travelersData;
            }
          } else {
            (application as any)[field] = dto[field];
          }
        }
      });

      // Recalculate step information if travelersData or numberOfTravellers changed
      if (dto.travelersData || dto.numberOfTravellers) {
        let travelersData = [];
        try {
          travelersData = application.travelersData
            ? JSON.parse(application.travelersData)
            : [];
        } catch {
          travelersData = [];
        }

        this.recalculateAllTravelersSteps(travelersData, application);
        this.checkAndUpdateApplicationStatusForIncompleteTravelers(
          travelersData,
          application
        );
      }

      application.applicationStatus = dto.applicationStatus;

      await application.save();

      const appJson = application.toJSON();
      const {
        currentStep: _currentStep,
        completedSteps: _completedSteps,
        stepProgress: _stepProgress,
        stepData: _stepData,
        ...rest
      } = appJson;
      return { application: rest };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async deleteVisaApplication(dto: VisaApplicationDeleteDto) {
    try {
      if (!dto || !dto.id) {
        callHTTPException("application id is required");
      }

      const application = await VisaApplication.findByPk(dto.id);
      if (!application) {
        callHTTPException("Visa application not found");
      }

      await application.destroy();
      return { id: dto.id, deleted: true };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async archiveVisaApplication(dto: VisaApplicationDeleteDto) {
    try {
      if (!dto || !dto.id) {
        callHTTPException("application id is required");
      }

      const application = await VisaApplication.findByPk(dto.id);
      if (!application) {
        callHTTPException("Visa application not found");
      }

      application.archivedAt = new Date();
      await application.save();

      const appJson = application.toJSON();
      const {
        currentStep: _currentStep,
        completedSteps: _completedSteps,
        stepProgress: _stepProgress,
        stepData: _stepData,
        ...rest
      } = appJson;
      return { application: rest };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  async unarchiveVisaApplication(dto: VisaApplicationDeleteDto) {
    try {
      if (!dto || !dto.id) {
        callHTTPException("application id is required");
      }

      const application = await VisaApplication.findByPk(dto.id);
      if (!application) {
        callHTTPException("Visa application not found");
      }

      application.archivedAt = null;
      await application.save();

      const appJson = application.toJSON();
      const {
        currentStep: _currentStep,
        completedSteps: _completedSteps,
        stepProgress: _stepProgress,
        stepData: _stepData,
        ...rest
      } = appJson;
      return { application: rest };
    } catch (err) {
      callHTTPException(err.message);
    }
  }

  private getStepInformation(application: VisaApplication) {
    const allSteps = [
      VisaApplicationStepType.CREATE_APPLICATION,
      VisaApplicationStepType.BASIC_DETAILS,
      VisaApplicationStepType.VISIT_DETAILS,
      VisaApplicationStepType.DOCUMENTS,
      VisaApplicationStepType.APPOINTMENT,
      VisaApplicationStepType.FULL_PAYMENT,
      VisaApplicationStepType.INSURANCE,
    ];
    let completedSteps: string[] = application.completedSteps || [];
    try {
      const paidCount = application.numberOfTravellers || 1;
      const travelersData = application.travelersData
        ? JSON.parse(application.travelersData)
        : [];

      const paidTravelers = Array.isArray(travelersData)
        ? travelersData.slice(0, paidCount)
        : [];

      if (paidTravelers.length > 0) {
        const perTravelerCalculated = paidTravelers.map((t) =>
          this.calculateCompletedStepsFromData(t, application)
        );

        const commonCompleted = allSteps.filter((step) =>
          perTravelerCalculated.every((arr) => arr.includes(step))
        );

        if (commonCompleted.length > 0) {
          completedSteps = commonCompleted;
        }
      }
    } catch {
      completedSteps = application.completedSteps || [];
    }
    const currentStep =
      application.currentStep || VisaApplicationStepType.CREATE_APPLICATION;
    const stepProgress = application.stepProgress || 0;

    let nextStep = null;
    for (const step of allSteps) {
      if (!completedSteps.includes(step)) {
        nextStep = step;
        break;
      }
    }

    let isCompleted = false;
    let isSubmitted = false;

    let travelersData: any[] = [];
    try {
      travelersData = application.travelersData
        ? JSON.parse(application.travelersData)
        : [];
    } catch {
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
      isSubmitted,
      applicationStatus: application.applicationStatus,
      stepNames: {
        [VisaApplicationStepType.CREATE_APPLICATION]: "Application Created",
        [VisaApplicationStepType.BASIC_DETAILS]: "Basic Details",
        [VisaApplicationStepType.VISIT_DETAILS]: "Visit Details",
        [VisaApplicationStepType.DOCUMENTS]: "Documents Upload",
        [VisaApplicationStepType.APPOINTMENT]: "Appointment",
        [VisaApplicationStepType.FULL_PAYMENT]: "Payment",
        [VisaApplicationStepType.INSURANCE]: "Insurance",
      },
    };
  }

  private getTravelerStepInformation(
    travelerData: any,
    application: VisaApplication
  ) {
    const allSteps = [
      VisaApplicationStepType.CREATE_APPLICATION,
      VisaApplicationStepType.BASIC_DETAILS,
      VisaApplicationStepType.VISIT_DETAILS,
      VisaApplicationStepType.DOCUMENTS,
      VisaApplicationStepType.APPOINTMENT,
      VisaApplicationStepType.FULL_PAYMENT, // Replace payment with full_payment
    ];

    const travelerIndex = travelerData.id ? parseInt(travelerData.id) - 1 : 0;
    // Only travelers beyond the initially paid count are considered additional
    const initiallyPaidCount =
      application.initiallyPaidTraveler || application.numberOfTravellers || 1;
    const isAdditionalTraveler = travelerIndex >= initiallyPaidCount;

    const travelerInsurance = travelerData.insurance;

    const travelerHasInsurance =
      travelerInsurance &&
      ((travelerInsurance.insurance === "own" &&
        (travelerInsurance.insuranceCertificate ||
          travelerInsurance.insuranceDetails?.certificateUploaded)) ||
        (travelerInsurance.insurance === "purchase" &&
          travelerInsurance.insurancePaymentCompleted === true &&
          travelerInsurance.orderId &&
          travelerInsurance.paymentAmount) ||
        travelerInsurance.insurance === "true");

    const hasBackwardCompatibilityInsurance = false; // Removed since we no longer have application.insurance

    const effectivelyHasInsurance =
      travelerHasInsurance || hasBackwardCompatibilityInsurance;

    const hasSelectedInsurance =
      travelerInsurance &&
      (travelerInsurance.insurance === "own" ||
        travelerInsurance.insurance === "purchase" ||
        travelerInsurance.insurance === "true");

    // If traveler selected insurance but it isn't effectively provided yet,
    // require that they complete FULL_PAYMENT which can include insurance purchase.
    const needsInsuranceStep = hasSelectedInsurance && !effectivelyHasInsurance;

    const calculatedCompletedSteps = this.calculateCompletedStepsFromData(
      travelerData,
      application
    );

    const completedSteps =
      calculatedCompletedSteps.length > 0
        ? calculatedCompletedSteps
        : travelerData.completedSteps || [];

    let currentStep =
      travelerData.currentStep || VisaApplicationStepType.BASIC_DETAILS;

    let nextStep = null;
    for (const step of allSteps) {
      if (!completedSteps.includes(step)) {
        nextStep = step;
        break;
      }
    }

    if (nextStep && nextStep !== VisaApplicationStepType.CREATE_APPLICATION) {
      currentStep = nextStep;
    }

    const stepProgressMap = {
      [VisaApplicationStepType.CREATE_APPLICATION]: 16,
      [VisaApplicationStepType.BASIC_DETAILS]: 33,
      [VisaApplicationStepType.VISIT_DETAILS]: 50,
      [VisaApplicationStepType.DOCUMENTS]: 66,
      [VisaApplicationStepType.APPOINTMENT]: 83,
      [VisaApplicationStepType.FULL_PAYMENT]: 100,
    };

    const hasInsurance = effectivelyHasInsurance;
    if (hasInsurance && !needsInsuranceStep) {
      stepProgressMap[VisaApplicationStepType.DOCUMENTS] = 100;
    }

    let stepProgress = 0;
    for (const step of completedSteps) {
      if (stepProgressMap[step] > stepProgress) {
        stepProgress = stepProgressMap[step];
      }
    }

    let isCompleted = false;

    const hasBasicCompletion =
      completedSteps.includes(VisaApplicationStepType.DOCUMENTS) &&
      completedSteps.includes(VisaApplicationStepType.APPOINTMENT) &&
      completedSteps.includes(VisaApplicationStepType.FULL_PAYMENT);

    // For travelers who selected insurance, FULL_PAYMENT must include insurance
    // Therefore completion simply requires FULL_PAYMENT as part of basic completion.
    isCompleted = hasBasicCompletion;

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
      isAdditionalTraveler,
      requiresInsurance: needsInsuranceStep,
      hasInsurance: effectivelyHasInsurance,
      stepNames: {
        [VisaApplicationStepType.CREATE_APPLICATION]: "Application Created",
        [VisaApplicationStepType.BASIC_DETAILS]: "Basic Details",
        [VisaApplicationStepType.VISIT_DETAILS]: "Visit Details",
        [VisaApplicationStepType.DOCUMENTS]: "Documents Upload",
        [VisaApplicationStepType.APPOINTMENT]: "Appointment",
        [VisaApplicationStepType.FULL_PAYMENT]: "Payment",
        [VisaApplicationStepType.INSURANCE]: "Insurance",
      },
    };
  }

  private calculateCompletedStepsFromData(
    travelerData: any,
    application?: VisaApplication
  ): string[] {
    const completedSteps = [];

    completedSteps.push(VisaApplicationStepType.CREATE_APPLICATION);

    if (this.isBasicDetailsComplete(travelerData.basicDetails)) {
      completedSteps.push(VisaApplicationStepType.BASIC_DETAILS);
    }

    if (this.isVisitDetailsComplete(travelerData.visitDetails)) {
      completedSteps.push(VisaApplicationStepType.VISIT_DETAILS);
    }

    if (this.isDocumentsComplete(travelerData.documents)) {
      completedSteps.push(VisaApplicationStepType.DOCUMENTS);
    }

    if (this.isAppointmentComplete(application?.appointment)) {
      completedSteps.push(VisaApplicationStepType.APPOINTMENT);
    }

    if (this.isInsuranceComplete(travelerData.insurance)) {
      completedSteps.push(VisaApplicationStepType.INSURANCE);
    }

    // If legacy payment is complete or fullPayment is complete, consider FULL_PAYMENT done
    const legacyPaymentDone = this.isPaymentComplete(
      travelerData.payment,
      application,
      travelerData
    );

    const fullPaymentDone = this.isFullPaymentComplete(
      travelerData.fullPayment,
      application,
      travelerData
    );

    if (legacyPaymentDone || fullPaymentDone) {
      completedSteps.push(VisaApplicationStepType.FULL_PAYMENT);
    }

    if (this.isInsuranceComplete(travelerData.insurance)) {
      completedSteps.push(VisaApplicationStepType.INSURANCE);
    }

    return completedSteps;
  }

  private isAppointmentComplete(appointment: any): boolean {
    if (!appointment) {
      return false;
    }

    const pref1 = appointment.preference1 || {};
    const hasCity = !!(pref1.city && pref1.city.trim());
    const hasSlot = !!(pref1.slot && pref1.slot.trim());
    const hasDateRange = !!(pref1.dateRange && pref1.dateRange.trim());

    return hasCity && (hasSlot || hasDateRange);
  }

  private isPaymentComplete(
    payment: any,
    application?: VisaApplication,
    travelerData?: any
  ): boolean {
    if (application && travelerData) {
      const paidTravelerCount = application.numberOfTravellers || 1;
      const travelerIndex = travelerData.id ? parseInt(travelerData.id) - 1 : 0;
      const isRegularTraveler = travelerIndex < paidTravelerCount;

      if (
        isRegularTraveler &&
        application.amountPaid &&
        parseFloat(application.amountPaid) > 0
      ) {
        return true;
      }
    }

    if (!payment) {
      return false;
    }

    const paymentStatus = payment.paymentStatus;
    const isCompleted =
      paymentStatus === "completed" || paymentStatus === "paid";

    return isCompleted;
  }

  private isFullPaymentComplete(
    fullPayment: any,
    _application?: VisaApplication,
    _travelerData?: any
  ): boolean {
    // For travelers, consider only explicit fullPayment completion flags.
    // We avoid treating application-level amountPaid/amountPaidTotal as
    // an indicator of FULL_PAYMENT to prevent insurance-only payments from
    // marking FULL_PAYMENT completed.
    if (!fullPayment) {
      return false;
    }

    const paymentStatus = fullPayment.paymentStatus;
    const isCompleted =
      paymentStatus === "completed" ||
      paymentStatus === "paid" ||
      fullPayment.paymentCompleted === true;

    // If the recorded fullPayment amount exactly matches the expected insurance
    // cost for the traveler, treat this as an insurance-only payment and DO NOT
    // mark FULL_PAYMENT as complete.
    try {
      const paidAmount = Number(fullPayment.paymentAmount);
      const expectedInsurance = this.calculateInsuranceCost(
        _travelerData,
        _application as any
      );
      if (!isNaN(paidAmount) && Math.abs(paidAmount - expectedInsurance) <= 1) {
        return false;
      }
    } catch {
      // ignore and fallthrough
    }

    return isCompleted;
  }

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
      return false;
    }

    const validationChecks = {
      visitingOtherSchengenCountries: !!(
        visitDetails.visitingOtherSchengenCountries &&
        Array.isArray(visitDetails.visitingOtherSchengenCountries) &&
        visitDetails.visitingOtherSchengenCountries.length > 0
      ),
      firstCountryOfEntry: !!visitDetails.firstCountryOfEntry,

      hasSchengenVisa: !!visitDetails.hasSchengenVisa,
      hasDigitalFingerprints: !!visitDetails.hasDigitalFingerprints,

      maritalStatus: !!visitDetails.maritalStatus,

      employmentStatus: !!visitDetails.employmentStatus,

      willAnyonePayForVisit: !!visitDetails.willAnyonePayForVisit,
    };

    if (visitDetails.hasSchengenVisa === "Yes") {
      validationChecks["lastVisaStartDate"] = !!visitDetails.lastVisaStartDate;
      validationChecks["lastVisaEndDate"] = !!visitDetails.lastVisaEndDate;
    }

    if (visitDetails.hasDigitalFingerprints === "Yes") {
      validationChecks["previousVisaNumber"] = !!(
        visitDetails.previousVisaNumber &&
        visitDetails.previousVisaNumber.trim()
      );
    }

    if (visitDetails.maritalStatus === "Married") {
      validationChecks["partnerFullName"] = !!(
        visitDetails.partnerFullName && visitDetails.partnerFullName.trim()
      );
      validationChecks["partnerDateOfBirth"] =
        !!visitDetails.partnerDateOfBirth;
    }

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

    if (visitDetails.employmentStatus === "Other") {
      validationChecks["otherEmploymentStatus"] = !!(
        visitDetails.otherEmploymentStatus &&
        visitDetails.otherEmploymentStatus.trim()
      );
    }

    if (visitDetails.willAnyonePayForVisit === "Yes") {
      validationChecks["fundingPersonName"] = !!(
        visitDetails.fundingPersonName && visitDetails.fundingPersonName.trim()
      );
      validationChecks["tripFundedBy"] = !!visitDetails.tripFundedBy;
    }

    const isComplete = Object.values(validationChecks).every(
      (check) => check === true
    );

    return isComplete;
  }

  private isDocumentsComplete(documents: any): boolean {
    if (!documents || !documents.documents) return false;
    const requiredDocuments = [
      { id: 1, minCount: 2, field: "passportPhotos" },
      { id: 2, minCount: 1, field: "bankStatements" },
      { id: 3, minCount: 1, field: "employmentProof" },
      { id: 5, minCount: 1, field: "ukVisa" },
    ];

    const docs = documents.documents || {};

    return requiredDocuments.every((req) => {
      const doc = docs[req.field];
      if (!doc) return false;
      if (req.id === 1) {
        const arr = Array.isArray(doc) ? doc : [doc];
        return arr.length >= req.minCount;
      }
      return true;
    });
  }

  private isInsuranceComplete(insurance: any): boolean {
    return (
      insurance?.insurancePaymentCompleted || insurance.insuranceCertificates
    );
  }

  private calculateInsuranceCost(
    travelerData: any,
    _application: VisaApplication
  ): number {
    const travelStartDate = travelerData?.basicDetails?.travelStartDate;
    const travelEndDate = travelerData?.basicDetails?.travelEndDate;

    if (travelStartDate && travelEndDate) {
      try {
        const start = new Date(travelStartDate);
        const end = new Date(travelEndDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const travelDays = Math.max(1, diffDays);
        const insuranceCost = travelDays * 2;

        return insuranceCost;
      } catch (error) {
        console.error("Error calculating travel days:", error);
      }
    }

    const defaultCost = 30 * 2;
    return defaultCost;
  }

  private validateInsurancePaymentAmount(
    travelerData: any,
    _application: VisaApplication
  ): boolean {
    const insurance = travelerData?.insurance;
    if (!insurance || insurance.insurance !== "purchase") {
      return true;
    }

    const expectedCost = this.calculateInsuranceCost(
      travelerData,
      _application
    );
    const paidAmount = insurance.paymentAmount;

    const isValidAmount =
      paidAmount && Math.abs(paidAmount - expectedCost) <= 1;

    return isValidAmount;
  }

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

  private checkAndUpdateApplicationStatusForIncompleteTravelers(
    travelersData: any[],
    application: VisaApplication
  ): void {
    if (!travelersData || travelersData.length === 0) {
      return;
    }

    const paidTravelerCount =
      application.initiallyPaidTraveler || application.numberOfTravellers || 1;
    const currentTravelerCount = travelersData.length;

    // if (currentTravelerCount > paidTravelerCount) {
    //   if (application.applicationStatus === "submitted") {
    //     application.applicationStatus = "payment_required";
    //   }
    // }

    const hasIncompleteTravelers = travelersData.some((traveler, index) => {
      const travelerStepInfo =
        traveler.stepInfo ||
        this.getTravelerStepInformation(traveler, application);

      const isAdditionalTraveler = index >= paidTravelerCount;

      if (isAdditionalTraveler) {
        const travelerHasInsurance =
          traveler.insurance &&
          traveler.insurance.insurance &&
          traveler.insurance.insurance !== "false";

        if (!travelerHasInsurance) {
          const hasCompletedInsurance =
            travelerStepInfo.completedSteps.includes(
              VisaApplicationStepType.INSURANCE
            );
          if (!hasCompletedInsurance) {
            return true;
          }
        }
      } else {
        const travelerHasInsurance =
          traveler.insurance &&
          traveler.insurance.insurance &&
          traveler.insurance.insurance !== "false";

        const hasBackwardCompatibilityInsurance = false; // Removed since we no longer have application.insurance

        const effectivelyHasInsurance =
          travelerHasInsurance || hasBackwardCompatibilityInsurance;

        if (!effectivelyHasInsurance) {
          const hasCompletedInsurance =
            travelerStepInfo.completedSteps.includes(
              VisaApplicationStepType.INSURANCE
            );
          if (!hasCompletedInsurance) {
            return true;
          }
        }
      }

      return !travelerStepInfo.isCompleted;
    });

    if (
      hasIncompleteTravelers &&
      application.applicationStatus === "submitted"
    ) {
      application.applicationStatus = "new";
    } else if (
      !hasIncompleteTravelers &&
      application.applicationStatus !== "submitted" &&
      application.applicationStatus !== "payment_required"
    ) {
      // application.applicationStatus = "submitted";
    }
  }

  private recalculateAllTravelersSteps(
    travelersData: any[],
    application: VisaApplication
  ): void {
    const initiallyPaidCount =
      application.initiallyPaidTraveler || application.numberOfTravellers || 1;

    travelersData.forEach((traveler, index) => {
      // Travelers beyond the initially paid count are considered additional
      const isAdditionalTraveler = index >= initiallyPaidCount;

      const currentStepInfo =
        traveler.stepInfo ||
        this.getTravelerStepInformation(traveler, application);

      const calculatedCompletedSteps = this.calculateCompletedStepsFromData(
        traveler,
        application
      );

      const existingSteps = currentStepInfo.completedSteps || [];
      const allCompletedSteps = [
        ...new Set([...existingSteps, ...calculatedCompletedSteps]),
      ];

      const allSteps = [
        VisaApplicationStepType.CREATE_APPLICATION,
        VisaApplicationStepType.BASIC_DETAILS,
        VisaApplicationStepType.VISIT_DETAILS,
        VisaApplicationStepType.DOCUMENTS,
        VisaApplicationStepType.APPOINTMENT,
        VisaApplicationStepType.FULL_PAYMENT,
        VisaApplicationStepType.INSURANCE,
      ];

      const travelerHasInsurance =
        traveler.insurance.insurancePaymentCompleted ||
        traveler.insurance.insuranceCertificates;

      const hasBackwardCompatibilityInsurance = false; // Removed since we no longer have application.insurance

      const effectivelyHasInsurance =
        travelerHasInsurance || hasBackwardCompatibilityInsurance;

      const needsInsuranceStep = !effectivelyHasInsurance;

      if (needsInsuranceStep) {
        if (!allSteps.includes(VisaApplicationStepType.INSURANCE)) {
          allSteps.push(VisaApplicationStepType.INSURANCE);
        }
      }

      let nextStep = null;
      for (const step of allSteps) {
        if (!allCompletedSteps.includes(step)) {
          nextStep = step;
          break;
        }
      }

      let isCompleted = false;

      if (needsInsuranceStep) {
        isCompleted = allCompletedSteps.includes(
          VisaApplicationStepType.INSURANCE
        );
      } else {
        isCompleted =
          allCompletedSteps.includes(VisaApplicationStepType.DOCUMENTS) &&
          allCompletedSteps.includes(VisaApplicationStepType.APPOINTMENT) &&
          allCompletedSteps.includes(VisaApplicationStepType.FULL_PAYMENT);
      }

      currentStepInfo.completedSteps = allCompletedSteps;
      currentStepInfo.currentStep = nextStep || currentStepInfo.currentStep;
      currentStepInfo.nextStep = nextStep;
      currentStepInfo.isCompleted = isCompleted;
      currentStepInfo.stepProgress =
        (allCompletedSteps.length / allSteps.length) * 100;
      currentStepInfo.isAdditionalTraveler = isAdditionalTraveler;
      currentStepInfo.requiresInsurance = needsInsuranceStep;
      currentStepInfo.hasInsurance = effectivelyHasInsurance;

      delete traveler.currentStep;
      delete traveler.completedSteps;
      delete traveler.completed;

      traveler.stepInfo = currentStepInfo;
    });

    const currentTravelerCount = travelersData.length;
    // if (currentTravelerCount > initiallyPaidCount) {
    //   if (application.applicationStatus === "submitted") {
    //     application.applicationStatus = "payment_required";
    //   }
    // }

    // Do not auto-submit or auto-reset; explicit submit action controls status

    try {
      const appAllSteps = [
        VisaApplicationStepType.CREATE_APPLICATION,
        VisaApplicationStepType.BASIC_DETAILS,
        VisaApplicationStepType.VISIT_DETAILS,
        VisaApplicationStepType.DOCUMENTS,
        VisaApplicationStepType.APPOINTMENT,
        VisaApplicationStepType.FULL_PAYMENT,
        VisaApplicationStepType.INSURANCE,
      ];

      const paidCount = application.numberOfTravellers || 1;
      const paidTravelers = travelersData.slice(0, paidCount);

      const appCompletedSteps: string[] = [];

      for (const step of appAllSteps) {
        const everyoneHasStep =
          paidTravelers.length > 0 &&
          paidTravelers.every((t) => {
            const tsi =
              t.stepInfo || this.getTravelerStepInformation(t, application);
            return (
              Array.isArray(tsi.completedSteps) &&
              tsi.completedSteps.includes(step)
            );
          });

        if (everyoneHasStep) {
          appCompletedSteps.push(step);
        }
      }

      // If no paid travelers or no steps completed, ensure at least CREATE_APPLICATION when present
      if (appCompletedSteps.length === 0 && application.createdAt) {
        // keep as empty or push create application? Only push if application already had this
        if (
          application.completedSteps &&
          application.completedSteps.includes(
            VisaApplicationStepType.CREATE_APPLICATION
          )
        ) {
          appCompletedSteps.push(VisaApplicationStepType.CREATE_APPLICATION);
        }
      }

      application.completedSteps = appCompletedSteps;

      // determine currentStep as first missing step
      let nextStep = null;
      for (const step of appAllSteps) {
        if (!appCompletedSteps.includes(step)) {
          nextStep = step;
          break;
        }
      }

      application.currentStep = nextStep || null;

      // Map steps to progress percentages (match traveler mapping roughly)
      const stepProgressMap = {
        [VisaApplicationStepType.CREATE_APPLICATION]: 16,
        [VisaApplicationStepType.BASIC_DETAILS]: 33,
        [VisaApplicationStepType.VISIT_DETAILS]: 50,
        [VisaApplicationStepType.DOCUMENTS]: 66,
        [VisaApplicationStepType.APPOINTMENT]: 83,
        [VisaApplicationStepType.FULL_PAYMENT]: 100,
        [VisaApplicationStepType.INSURANCE]: 100,
      } as any;

      let appStepProgress = 0;
      for (const s of appCompletedSteps) {
        if (stepProgressMap[s] && stepProgressMap[s] > appStepProgress) {
          appStepProgress = stepProgressMap[s];
        }
      }

      // If application status is submitted, ensure 100
      if (application.applicationStatus === "submitted") appStepProgress = 100;

      application.stepProgress = appStepProgress;
    } catch (err) {
      // don't crash on step calculation
      console.error("Error recalculating application-level steps:", err);
    }
  }

  private checkForUnpaidAdditionalTravelers(
    travelersData: any[],
    application: VisaApplication
  ): boolean {
    if (!travelersData || !Array.isArray(travelersData)) {
      return false;
    }

    const initiallyPaidCount =
      application.initiallyPaidTraveler || application.numberOfTravellers || 1;

    for (let i = initiallyPaidCount; i < travelersData.length; i++) {
      const traveler = travelersData[i];
      const stepInfo = this.getTravelerStepInformation(traveler, application);

      // If traveler requires insurance step and doesn't have insurance, they are unpaid
      if (stepInfo.requiresInsurance && !stepInfo.hasInsurance) {
        return true;
      }

      // If traveler hasn't completed full payment, treat as unpaid additional traveler
      const hasFullPayment = Array.isArray(stepInfo.completedSteps)
        ? stepInfo.completedSteps.includes(VisaApplicationStepType.FULL_PAYMENT)
        : false;

      if (!hasFullPayment) {
        return true;
      }
    }

    return false;
  }
}
