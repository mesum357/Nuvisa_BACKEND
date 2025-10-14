import * as bcrypt from "bcrypt";
import {
  Table,
  Unique,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
} from "sequelize-typescript";

@Table({ tableName: "users", timestamps: true })
export class User extends Model<User> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @AllowNull(false)
  @Column({ type: DataType.UUID })
  id: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING })
  first_name: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  user_name: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING })
  last_name: string;

  @AllowNull(false)
  @Unique({
    name: "email_unique_constraint",
    msg: "Email must be unique.",
  })
  @Column({ type: DataType.STRING })
  email: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  phone_no: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  otp;

  @AllowNull(true)
  @Column({
    type: DataType.DATE,
  })
  otp_expiry: Date;

  @AllowNull(true)
  @Column({ type: DataType.BOOLEAN, field: 'is_verified', defaultValue: false })
  is_verified: boolean;

  @AllowNull(true)
  @Column({ type: DataType.STRING, field: 'status', defaultValue: 'ACTIVE' })
  status: string;
}
