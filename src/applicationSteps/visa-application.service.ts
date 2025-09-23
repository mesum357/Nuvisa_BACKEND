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
  async checkIfUserExists(id): Promise<User> {
    const user = await User.findByPk(id);
    return user;
  }

  async getUserVisaApplications(userId) {
    try {
      const user = await this.checkIfUserExists(userId);

      const userVisaApplications = await VisaApplication.findAll({
        where: { email: user.email },
      });

      const applicationsWithParsedData = userVisaApplications.map((app) => {
        let parsedTravelersData = null;

        if (app.travelersData) {
          try {
            parsedTravelersData = JSON.parse(app.travelersData);
          } catch (error) {
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
                insurance: app.insurance || "false",
                insuranceDetails:
                  app.insurance === "true" ? { selected: true } : null,
              },
            })
          );

          app.travelersData = JSON.stringify(parsedTravelersData);
          app.save().catch((error) => {
            console.error(
              `Failed to save initialized travelersData for app ${app.id}:`,
              error
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
              currentStep,
              completedSteps,
              completed,
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
          currentStep,
          completedSteps,
          stepProgress,
          stepData,
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

      if (!parsedTravelersData && userVisaApplication.numberOfTravellers) {
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
              insurance: userVisaApplication.insurance || "false",
              insuranceDetails:
                userVisaApplication.insurance === "true"
                  ? { selected: true }
                  : null,
            },
          })
        );

        userVisaApplication.travelersData = JSON.stringify(parsedTravelersData);
        await userVisaApplication.save();
      }

      if (Array.isArray(parsedTravelersData)) {
        parsedTravelersData = parsedTravelersData.map((traveler) => {
          const travelerStepInfo = this.getTravelerStepInformation(
            traveler,
            userVisaApplication
          );

          const {
            currentStep,
            completedSteps,
            completed,
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
        let processedTravelersData = dto.travelersData;

        if (!processedTravelersData) {
          const numberOfTravelers = dto.numberOfTravellers || 1;
          processedTravelersData = [];

          for (let i = 1; i <= numberOfTravelers; i++) {
            processedTravelersData.push({
              id: i,
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
                insurance: "",
                insuranceDetails: null,
                insuranceCertificate: null,
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
            });
          }
        }

        if (dto.travelersData && dto.insurance) {
          processedTravelersData = dto.travelersData.map((traveler, index) => {
            const numberOfPaidTravelers = dto.numberOfTravellers || 1;
            if (index < numberOfPaidTravelers) {
              return {
                ...traveler,
                insurance: {
                  ...traveler.insurance,
                  insurance: dto.insurance,
                  insuranceDetails:
                    dto.insurance === "true" ? { selected: true } : null,
                },
              };
            }
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

        application = await VisaApplication.create({
          email: dto.email,
          country: dto.country,
          visaTypeId: dto.visaTypeId,
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
          if (
            this.areAllTravelersCompleted(updatedTravelersData, application)
          ) {
            if (application.applicationStatus !== "submitted") {
              application.applicationStatus = "submitted";
            }
          }
        }

        // No more global step tracking - only traveler-specific stepInfo is managed

        if (dto.type === VisaApplicationStepType.BASIC_DETAILS) {
          const dtoForLogging = filterSensitiveDataForLogging(dto);
          const incomingBasic = (dto as any).basicDetails;
          if (incomingBasic && typeof dto.currentTravelerIndex === "number") {
            try {
              if (travelersData[dto.currentTravelerIndex]) {
                travelersData[dto.currentTravelerIndex].basicDetails = {
                  ...(travelersData[dto.currentTravelerIndex].basicDetails ||
                    {}),
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
          const incomingAppointment = (dto as any).appointment;

          if (incomingAppointment && dto.currentTravelerIndex !== undefined) {
            try {
              if (travelersData[dto.currentTravelerIndex]) {
                travelersData[dto.currentTravelerIndex].appointment = {
                  ...(travelersData[dto.currentTravelerIndex].appointment ||
                    {}),
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
            application.applicationStatus = "submitted";
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
            application.applicationStatus = "submitted";
          }
        }

        if (dto.type === VisaApplicationStepType.INSURANCE) {
          if (
            dto.paymentType === "additional_traveler_insurance" ||
            dto.paymentType === "traveler_insurance"
          ) {
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

                currentTraveler.insurance.insuranceDetails = {
                  selected: true,
                  paid: true,
                  paymentType: dto.paymentType,
                };
              }

              application.travelersData = JSON.stringify(travelersData);
              this.recalculateAllTravelersSteps(travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                travelersData,
                application
              );
            }
          } else {
            if (dto.travelersData && Array.isArray(dto.travelersData)) {
              application.travelersData = JSON.stringify(dto.travelersData);

              this.recalculateAllTravelersSteps(dto.travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                dto.travelersData,
                application
              );
            } else if (travelersData.length > 0) {
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
              }

              application.travelersData = JSON.stringify(travelersData);
              this.recalculateAllTravelersSteps(travelersData, application);
              this.checkAndUpdateApplicationStatusForIncompleteTravelers(
                travelersData,
                application
              );
            }
          }

          const currentTravelersData = dto.travelersData || travelersData;
          if (
            this.areAllTravelersCompleted(currentTravelersData, application)
          ) {
            application.applicationStatus = "submitted";
          } else {
            const hasUnpaidAdditionalTravelers =
              this.checkForUnpaidAdditionalTravelers(
                currentTravelersData,
                application
              );
            if (hasUnpaidAdditionalTravelers) {
              application.applicationStatus = "payment_required";
            }
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
                    ...(currentTraveler.insurance.insuranceDetails || {}),
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
          }
        }

        await application.save();
      }

      let parsedTravelersData = null;
      if (application.travelersData) {
        try {
          parsedTravelersData = JSON.parse(application.travelersData);

          if (Array.isArray(parsedTravelersData)) {
            parsedTravelersData = parsedTravelersData.map((traveler, index) => {
              const travelerStepInfo = this.getTravelerStepInformation(
                traveler,
                application
              );

              const {
                currentStep,
                completedSteps,
                completed,
                ...cleanTravelerData
              } = traveler;

              const finalTravelerData = {
                ...cleanTravelerData,
                stepInfo: travelerStepInfo,
              };

              return finalTravelerData;
            });
          }
        } catch (error) {
          console.error("Error parsing travelersData:", error);
          parsedTravelersData = null;
        }
      }

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

      return {
        application: applicationWithParsedData,
      };
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
      const { currentStep, completedSteps, stepProgress, stepData, ...rest } =
        appJson;
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
      const { currentStep, completedSteps, stepProgress, stepData, ...rest } =
        appJson;
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
    ];

    allSteps.push(VisaApplicationStepType.INSURANCE);

    const completedSteps = application.completedSteps || [];
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
      isSubmitted,
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
      VisaApplicationStepType.APPOINTMENT,
      VisaApplicationStepType.PAYMENT, // Add payment step
    ];

    const paidTravelerCount = application.numberOfTravellers || 1;
    const travelerIndex = travelerData.id ? parseInt(travelerData.id) - 1 : 0;
    const isAdditionalTraveler = travelerIndex >= paidTravelerCount;

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

    const hasBackwardCompatibilityInsurance =
      !travelerHasInsurance &&
      application.insurance &&
      application.insurance !== "false";

    const effectivelyHasInsurance =
      travelerHasInsurance || hasBackwardCompatibilityInsurance;

    const hasSelectedInsurance =
      travelerInsurance &&
      (travelerInsurance.insurance === "own" ||
        travelerInsurance.insurance === "purchase" ||
        travelerInsurance.insurance === "true");

    const needsInsuranceStep = hasSelectedInsurance && !effectivelyHasInsurance;

    if (needsInsuranceStep) {
      if (!allSteps.includes(VisaApplicationStepType.INSURANCE)) {
        allSteps.push(VisaApplicationStepType.INSURANCE);
      }
    }

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
      [VisaApplicationStepType.PAYMENT]: 100,
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
      completedSteps.includes(VisaApplicationStepType.PAYMENT);

    if (needsInsuranceStep) {
      isCompleted =
        hasBasicCompletion &&
        completedSteps.includes(VisaApplicationStepType.INSURANCE);
    } else {
      isCompleted = hasBasicCompletion;
    }

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
        [VisaApplicationStepType.PAYMENT]: "Payment",
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

    if (this.isAppointmentComplete(travelerData.appointment)) {
      completedSteps.push(VisaApplicationStepType.APPOINTMENT);
    }

    if (
      this.isPaymentComplete(travelerData.payment, application, travelerData)
    ) {
      completedSteps.push(VisaApplicationStepType.PAYMENT);
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

    const requiredDocIds = [1, 2, 5];
    return requiredDocIds.every((id) => documents.documents[id]);
  }

  private isInsuranceComplete(insurance: any): boolean {
    if (!insurance) {
      return false;
    }

    const insuranceValue = insurance.insurance;

    if (insuranceValue === "true" || insuranceValue === true) {
      return true;
    }

    if (
      insuranceValue === "false" &&
      insurance.orderId &&
      insurance.paymentAmount
    ) {
      insurance.insurance = "true";
      return true;
    }

    if (insuranceValue === "purchase") {
      const paymentCompleted = insurance.insurancePaymentCompleted === true;
      const hasOrderId = !!insurance.orderId;
      const hasPaymentAmount = !!insurance.paymentAmount;
      const hasPaymentDate = !!insurance.paymentDate;

      const isComplete =
        paymentCompleted && hasOrderId && hasPaymentAmount && hasPaymentDate;

      if (isComplete) {
        insurance.insurance = "true";
      }

      return isComplete;
    }
    if (insuranceValue === "own") {
      let hasCertificate = false;

      if (insurance.insuranceCertificate) {
        if (typeof insurance.insuranceCertificate === "string") {
          hasCertificate = insurance.insuranceCertificate.trim() !== "";
        } else if (
          typeof insurance.insuranceCertificate === "object" &&
          insurance.insuranceCertificate !== null
        ) {
          hasCertificate = true;
        } else {
          hasCertificate = true;
        }
      }

      const hasDetailsFlag = !!insurance.insuranceDetails?.certificateUploaded;

      const isComplete = hasCertificate || hasDetailsFlag;

      if (isComplete) {
        insurance.insurance = "true";
      }

      return isComplete;
    }

    return false;
  }

  private calculateInsuranceCost(
    travelerData: any,
    application: VisaApplication
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
    application: VisaApplication
  ): boolean {
    const insurance = travelerData?.insurance;
    if (!insurance || insurance.insurance !== "purchase") {
      return true;
    }

    const expectedCost = this.calculateInsuranceCost(travelerData, application);
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

    const paidTravelerCount = application.numberOfTravellers || 1;
    const currentTravelerCount = travelersData.length;

    if (currentTravelerCount > paidTravelerCount) {
      const additionalTravelersCount = currentTravelerCount - paidTravelerCount;

      if (application.applicationStatus === "submitted") {
        application.applicationStatus = "payment_required";
      }
    }

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
      application.applicationStatus = "submitted";
    }
  }

  private recalculateAllTravelersSteps(
    travelersData: any[],
    application: VisaApplication
  ): void {
    const paidTravelerCount = application.numberOfTravellers || 1;

    travelersData.forEach((traveler, index) => {
      const isAdditionalTraveler = index >= paidTravelerCount;

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
        VisaApplicationStepType.PAYMENT,
      ];

      const travelerHasInsurance =
        traveler.insurance &&
        traveler.insurance.insurance &&
        traveler.insurance.insurance !== "false";

      const hasBackwardCompatibilityInsurance =
        !travelerHasInsurance &&
        application.insurance &&
        application.insurance !== "false";

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
          allCompletedSteps.includes(VisaApplicationStepType.PAYMENT);
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
    if (currentTravelerCount > paidTravelerCount) {
      if (application.applicationStatus === "submitted") {
        application.applicationStatus = "payment_required";
      }
    }

    if (this.areAllTravelersCompleted(travelersData, application)) {
      if (
        application.applicationStatus !== "submitted" &&
        application.applicationStatus !== "payment_required"
      ) {
        application.applicationStatus = "submitted";
      }
    } else {
      if (application.applicationStatus === "submitted") {
        application.applicationStatus = "new";
      }
    }
  }

  private checkForUnpaidAdditionalTravelers(
    travelersData: any[],
    application: VisaApplication
  ): boolean {
    if (!travelersData || !Array.isArray(travelersData)) {
      return false;
    }

    const paidTravelerCount = application.numberOfTravellers || 1;

    for (let i = paidTravelerCount; i < travelersData.length; i++) {
      const traveler = travelersData[i];
      const stepInfo = this.getTravelerStepInformation(traveler, application);

      if (stepInfo.requiresInsurance && !stepInfo.hasInsurance) {
        return true;
      }
    }

    return false;
  }
}
