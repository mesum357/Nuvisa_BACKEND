import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  Unique,
} from "sequelize-typescript";

@Table({ tableName: "visa_pricing", timestamps: true })
export class VisaPricing extends Model<VisaPricing> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @AllowNull(false)
  @Column({ type: DataType.UUID })
  id: string;

  @AllowNull(false)
  @Unique
  @Column({ type: DataType.STRING })
  name: string;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.FLOAT })
  basePrice: number;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.FLOAT })
  strikeOutPrice: number;

  @AllowNull(false)
  @Default("")
  @Column({ type: DataType.TEXT })
  reason: string;

  @AllowNull(false)
  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  showReason: boolean;
}

