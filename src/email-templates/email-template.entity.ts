import {
  Table,
  Unique,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  Index,
} from "sequelize-typescript";

@Table({ tableName: "email_templates", timestamps: true })
export class EmailTemplate extends Model<EmailTemplate> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @AllowNull(false)
  @Column({ type: DataType.UUID })
  id: string;

  @Index
  @AllowNull(false)
  @Unique({
    name: "email_template_key_unique",
    msg: "Template key must be unique.",
  })
  @Column({ type: DataType.STRING })
  key: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING })
  name: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  subject: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  body: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  description: string;

  @Default(true)
  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN })
  isActive: boolean;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  updatedBy: string;

  @Column({ type: DataType.DATE, field: "createdAt" })
  createdAt: Date;

  @Column({ type: DataType.DATE, field: "updatedAt" })
  updatedAt: Date;
}

