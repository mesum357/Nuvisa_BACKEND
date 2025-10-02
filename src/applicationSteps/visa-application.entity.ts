import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
} from "sequelize-typescript";

@Table({ tableName: "visa_applications", timestamps: true })
export class VisaApplication extends Model<VisaApplication> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @AllowNull(false)
  @Column({ type: DataType.UUID })
  id: string;

  // Application level fields
  @AllowNull(true)
  @Column({ type: DataType.STRING })
  email: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  paymentStatus: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  paymentMethod: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  country: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  visaTypeId: string; // SMV Konveyor visa type ID

  @AllowNull(true)
  @Column({ type: DataType.JSON })
  selectedVisaType: any; // Complete selected visa type object from SMV API

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  orderId: string; // SMV Konveyor order ID from /orders endpoint

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  amountPaid: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  applicationStatus: string;

  // Traveler management fields
  @AllowNull(true)
  @Default(1)
  @Column({ type: DataType.INTEGER })
  numberOfTravellers: number;

  @AllowNull(true)
  @Default(1)
  @Column({ type: DataType.INTEGER })
  initiallyPaidTraveler: number; // Number of travelers initially paid for

  @AllowNull(true)
  @Column({ type: DataType.INTEGER })
  totalTraveler: number; // Total number of travelers (including additional)

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  amountPaidTotal: string; // Total amount paid for all travelers

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  initialInsurancePaidTotal: string; // Total insurance amount paid initially

  @AllowNull(true)
  @Column({ type: DataType.JSON })
  travelersData: any; // Complete structured data for all travelers

  // Application step tracking fields
  @AllowNull(true)
  @Column({ type: DataType.STRING })
  currentStep: string;

  @AllowNull(true)
  @Column({ type: DataType.JSON })
  completedSteps: string[];

  @AllowNull(true)
  @Column({ type: DataType.INTEGER })
  stepProgress: number; // percentage or step number

  @AllowNull(true)
  @Column({ type: DataType.JSON })
  stepData: any; // store step-specific metadata

  @AllowNull(true)
  @Column({ type: DataType.JSON })
  fullPayment: any; // Application-level full payment information

  @AllowNull(true)
  @Column({ type: DataType.DATE })
  archivedAt: Date;
}
