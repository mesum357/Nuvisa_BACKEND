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
  insurance: string;

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
}
